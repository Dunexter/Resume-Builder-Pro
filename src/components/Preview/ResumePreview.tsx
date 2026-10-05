import React from 'react';
import { useAppSelector } from '../../hooks';
import ProfessionalTemplate from './templates/ProfessionalTemplate';
import ModernTemplate from './templates/ModernTemplate';
import ClassicTemplate from './templates/ClassicTemplate';
import CompactTemplate from './templates/CompactTemplate';
import ExecutiveTemplate from './templates/ExecutiveTemplate';
import { ResumeData } from '../../types/resume';

export const ResumeDocument: React.FC<{ data: ResumeData; id?: string }> = ({ data: resumeData, id = 'resume-preview' }) => {
  const template = resumeData.styling.template;

  const renderTemplate = () => {
    switch (template) {
      case 'modern':    return <ModernTemplate data={resumeData} />;
      case 'classic':   return <ClassicTemplate data={resumeData} />;
      case 'compact':   return <CompactTemplate data={resumeData} />;
      case 'executive': return <ExecutiveTemplate data={resumeData} />;
      default:          return <ProfessionalTemplate data={resumeData} />;
    }
  };

  return (
    <div
      id={id}
      className="resume-document bg-white shadow-lg mx-auto"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: template === 'compact' ? 0 : '20mm 18mm',
        boxSizing: 'border-box',
        backgroundColor: '#fff',
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-line',
      }}
    >
      <style>{`
        .resume-document, .resume-document * { box-sizing: border-box; }
        .resume-document div, .resume-document span { min-width: 0; }
        .resume-document [data-pdf-row] { break-inside: avoid; }
        .resume-document h2 { break-after: avoid; }
        .resume-document ul { list-style-type: disc; list-style-position: outside; }
      `}</style>
      {renderTemplate()}
    </div>
  );
};

const ResumePreview: React.FC = () => {
  const data = useAppSelector(state => state.resume.data);
  return <ResumeDocument data={data} />;
};

export default ResumePreview;
