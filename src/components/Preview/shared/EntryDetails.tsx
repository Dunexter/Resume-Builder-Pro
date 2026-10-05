import React from 'react';
import { CertificationEntry, EducationEntry } from '../../../types/resume';

export function EducationDetails({ entry, coursework = false }: { entry: EducationEntry; coursework?: boolean }): React.ReactElement {
  return <div style={{ fontSize: '0.9em', marginTop: 2 }}>
    {coursework && entry.coursework && <div>Coursework: {entry.coursework}</div>}
    {entry.honors && <div>Honors: {entry.honors}</div>}
  </div>;
}

export function CertificationDetails({ entry }: { entry: CertificationEntry }): React.ReactElement {
  return <div style={{ fontSize: '0.9em', marginTop: 2 }}>
    {entry.expiryDate && <div>Expires: {entry.expiryDate}</div>}
    {entry.credentialId && <div>Credential ID: {entry.credentialId}</div>}
  </div>;
}
