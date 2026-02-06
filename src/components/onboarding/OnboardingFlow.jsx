import { useState } from 'react';
import { ProfileSetup } from './ProfileSetup';
import { CompanySetup } from './CompanySetup';
import { execute, lastInsertRowId } from '../../db/database';

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
      // Step 1: Create user
      await execute(
        'INSERT INTO users (name, email, role) VALUES (?, ?, ?)',
        [profileData.name, profileData.email || null, profileData.role || null]
      );
      const userId = lastInsertRowId('users');

      // Step 2: Create company
      await execute(
        'INSERT INTO companies (user_id, name, estimated_size, industry) VALUES (?, ?, ?, ?)',
        [userId, companyData.name, companyData.estimated_size || null, companyData.industry || null]
      );

      // Step 3: Create user as first contact
      const now = new Date().toLocaleDateString('de-DE', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      await execute(
        `INSERT INTO contacts (user_id, external_id, name, company, position, connected_on, is_company_placeholder, custom_estimated_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          `user_${userId}`,
          profileData.name,
          companyData.name,
          profileData.role || 'Ich',
          now,
          0,
          companyData.estimated_size || null,
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
