import { useState } from 'react';
import { ProfileSetup } from './ProfileSetup';
import { CompanySetup } from './CompanySetup';
import { execute, lastInsertRowId } from '../../db/database';
import { hashPassword } from '../../utils/crypto';

export function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState(1);
  const [profileData, setProfileData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleProfileComplete = (data) => {
    setProfileData(data);
    setStep(2);
  };

  const handleCompanyComplete = async (companyData) => {
    if (!profileData) {
      setError('Profildaten fehlen. Bitte starte neu.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Create profile with password
      const { hash, salt } = await hashPassword(profileData.password);
      await execute(
        'INSERT INTO profile (name, email, role, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)',
        [profileData.name, profileData.email || null, profileData.role || null, hash, salt]
      );
      const userId = lastInsertRowId('profile');

      // Step 2: Create company
      await execute(
        'INSERT INTO companies (user_id, name, estimated_size, industry) VALUES (?, ?, ?, ?)',
        [userId, companyData.name, companyData.estimated_size || null, companyData.industry || null]
      );
      const companyId = lastInsertRowId('companies');

      // Step 3: Link profile to company
      await execute(
        'UPDATE profile SET company_id = ? WHERE id = ?',
        [companyId, userId]
      );

      // Step 4: Create user as first contact (with company_id FK)
      const now = new Date().toLocaleDateString('de-DE', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      await execute(
        `INSERT INTO contacts (user_id, external_id, name, company_id, position, connected_on)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          `user_${userId}`,
          profileData.name,
          companyId,
          profileData.role || 'Ich',
          now,
        ]
      );

      // Small delay to ensure IndexedDB persistence is complete
      await new Promise(resolve => setTimeout(resolve, 200));

      window.location.reload();
    } catch (err) {
      console.error('Error saving data:', err);
      setError('Fehler beim Speichern: ' + err.message);
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setError(null);
  };

  if (step === 1) {
    return (
      <ProfileSetup
        onComplete={handleProfileComplete}
        initialData={profileData}
      />
    );
  }

  return (
    <CompanySetup
      onComplete={handleCompanyComplete}
      onBack={handleBack}
      isSubmitting={isSubmitting}
      error={error}
    />
  );
}
