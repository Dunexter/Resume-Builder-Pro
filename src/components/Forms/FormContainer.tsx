import React from 'react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import PersonalInfoForm from './PersonalInfoForm';
import ExperienceForm from './ExperienceForm';
import EducationForm from './EducationForm';
import SkillsForm from './SkillsForm';
import ProjectsForm from './ProjectsForm';
import AwardsForm from './AwardsForm';
import CertificationsForm from './CertificationsForm';
import CustomSectionForm from './CustomSectionForm';
import StylingForm from './StylingForm';
import ATSScoreForm from './ATSScoreForm';
import JDMatcherForm from './JDMatcherForm';
import AISettingsForm from './AISettingsForm';
import AIReviewForm from './AIReviewForm';

const FormContainer: React.FC = () => {
  const activeSection = useAppSelector(state => state.resume.activeSection);
  const sectionOrder = useAppSelector(state => state.resume.data.sectionOrder);
  const customSections = useAppSelector(state => state.resume.data.sections.custom);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);

  const scrollCls = `flex-1 overflow-y-auto p-5 ${darkMode ? 'text-gray-100' : ''}`;

  const renderForm = () => {
    switch (activeSection) {
      case 'personal':       return <PersonalInfoForm />;
      case 'experience':     return <ExperienceForm />;
      case 'education':      return <EducationForm />;
      case 'skills':         return <SkillsForm />;
      case 'projects':       return <ProjectsForm />;
      case 'awards':         return <AwardsForm />;
      case 'certifications': return <CertificationsForm />;
      case 'styling':        return <StylingForm />;
      case 'ats':            return <ATSScoreForm />;
      case 'jdmatcher':      return <JDMatcherForm />;
      case 'aireview':       return <AIReviewForm />;
      case 'aisettings':     return <AISettingsForm />;
      default: {
        // Custom sections
        const section = sectionOrder.find(s => s.id === activeSection && s.type === 'custom');
        const customData = customSections.find(c => c.id === activeSection);
        if (section && customData) return <CustomSectionForm sectionId={activeSection} />;
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            Select a section from the sidebar
          </div>
        );
      }
    }
  };

  return (
    <div className={scrollCls}>
      {renderForm()}
    </div>
  );
};

export default FormContainer;
