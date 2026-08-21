import React, { useState } from 'react';
import {
  User, GraduationCap, Briefcase, Code, Trophy, Palette, Plus,
  GripVertical, Eye, EyeOff, Target, Zap, Award, FileSearch,
  Settings, Bot, ChevronRight, ChevronUp, ChevronDown
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { setActiveSection, updateSectionOrder, toggleSectionVisibility, addCustomSection } from '../../store/resumeSlice';
import { SectionOrder } from '../../types/resume';

const SECTION_ICONS: Record<string, React.FC<{ className?: string }>> = {
  personal: User,
  experience: Briefcase,
  education: GraduationCap,
  skills: Code,
  projects: FileSearch,
  awards: Trophy,
  certifications: Award,
  styling: Palette,
  custom: Zap,
  ats: Target,
  jdmatcher: FileSearch,
  aisettings: Bot,
};

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const dispatch = useAppDispatch();
  const activeSection = useAppSelector(state => state.resume.activeSection);
  const sectionOrder = useAppSelector(state => state.resume.data.sectionOrder);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const jdMatchResult = useAppSelector(state => state.resume.jdMatchResult);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customSectionName, setCustomSectionName] = useState('');

  const dm = darkMode;
  const bg = dm ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200';
  const activeCls = dm ? 'bg-indigo-900 text-indigo-200 border-indigo-700' : 'bg-indigo-50 text-indigo-700 border-indigo-200';
  const hoverCls = dm ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100';

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;
    const newOrder = [...sectionOrder];
    const fromIdx = newOrder.findIndex(s => s.id === draggedItem);
    const toIdx = newOrder.findIndex(s => s.id === targetId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const [item] = newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, item);
      dispatch(updateSectionOrder(newOrder));
    }
    setDraggedItem(null);
  };

  /** Keyboard/touch-friendly alternative to drag-and-drop reordering. */
  const moveSection = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sectionOrder.length) return;
    const newOrder = [...sectionOrder];
    const [item] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, item);
    dispatch(updateSectionOrder(newOrder));
  };

  const handleAddCustomSection = () => {
    if (customSectionName.trim()) {
      dispatch(addCustomSection(customSectionName.trim()));
      setCustomSectionName('');
      setShowAddCustom(false);
    }
  };

  const NavBtn: React.FC<{ id: string; label: string; icon: React.FC<{ className?: string }>; badge?: React.ReactNode }> = ({ id, label, icon: Icon, badge }) => {
    const isActive = activeSection === id;
    return (
      <button
        onClick={() => {
          dispatch(setActiveSection(id));
          onCloseMobile?.();
        }}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all text-sm font-medium border ${isActive ? activeCls : `border-transparent ${hoverCls}`}`}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        {badge}
        {isActive && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />}
      </button>
    );
  };

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onCloseMobile} />
      )}
      <div
        className={`w-60 border-r ${bg} flex flex-col h-full overflow-hidden flex-shrink-0 fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* Top fixed: Personal */}
        <NavBtn id="personal" label="Personal Info" icon={User} />

        <div className={`my-2 border-t ${dm ? 'border-gray-700' : 'border-gray-200'}`} />

        {/* Label */}
        <div className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
          Resume Sections
          <span className={`ml-1.5 text-xs font-normal normal-case ${dm ? 'text-gray-600' : 'text-gray-400'}`}>(drag to reorder)</span>
        </div>

        {/* Draggable sections */}
        {sectionOrder.map((section, index) => {
          const Icon = SECTION_ICONS[section.type] || Code;
          const isActive = activeSection === section.id;
          return (
            <div
              key={section.id}
              draggable
              onDragStart={e => handleDragStart(e, section.id)}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, section.id)}
              className={`group flex items-center gap-1 px-2 py-2 rounded-lg cursor-move transition-all border text-sm font-medium ${
                isActive ? activeCls : `border-transparent ${hoverCls}`
              } ${draggedItem === section.id ? 'opacity-40 scale-95' : ''}`}
            >
              <GripVertical className={`h-3.5 w-3.5 flex-shrink-0 ${dm ? 'text-gray-600 group-hover:text-gray-400' : 'text-gray-300 group-hover:text-gray-500'}`} />
              <button
                onClick={() => dispatch(setActiveSection(section.id))}
                className="flex-1 flex items-center gap-2 text-left min-w-0"
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{section.name}</span>
              </button>
              <div className="flex flex-col flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  onClick={e => { e.stopPropagation(); moveSection(index, -1); }}
                  disabled={index === 0}
                  aria-label={`Move ${section.name} up`}
                  className={`p-0.5 rounded disabled:opacity-30 disabled:cursor-not-allowed ${dm ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                >
                  <ChevronUp className={`h-3 w-3 ${dm ? 'text-gray-400' : 'text-gray-500'}`} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); moveSection(index, 1); }}
                  disabled={index === sectionOrder.length - 1}
                  aria-label={`Move ${section.name} down`}
                  className={`p-0.5 rounded disabled:opacity-30 disabled:cursor-not-allowed ${dm ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                >
                  <ChevronDown className={`h-3 w-3 ${dm ? 'text-gray-400' : 'text-gray-500'}`} />
                </button>
              </div>
              <button
                onClick={e => { e.stopPropagation(); dispatch(toggleSectionVisibility(section.id)); }}
                aria-label={`${section.visible ? 'Hide' : 'Show'} ${section.name}`}
                className={`p-1 rounded transition-colors flex-shrink-0 ${dm ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
              >
                {section.visible
                  ? <Eye className={`h-3 w-3 ${dm ? 'text-gray-400' : 'text-gray-500'}`} />
                  : <EyeOff className="h-3 w-3 text-gray-400" />}
              </button>
            </div>
          );
        })}

        {/* Add custom section */}
        <div className="pt-1">
          {showAddCustom ? (
            <div className="space-y-2 px-1">
              <input
                type="text"
                value={customSectionName}
                onChange={e => setCustomSectionName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCustomSection()}
                placeholder="Section name"
                autoFocus
                className={`w-full px-2.5 py-1.5 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${dm ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300'}`}
              />
              <div className="flex gap-1.5">
                <button onClick={handleAddCustomSection} className="flex-1 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Add</button>
                <button onClick={() => { setShowAddCustom(false); setCustomSectionName(''); }} className={`flex-1 py-1 text-xs rounded-lg transition-colors ${dm ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCustom(true)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border-2 border-dashed transition-colors ${dm ? 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400' : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600'}`}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Custom Section
            </button>
          )}
        </div>

        <div className={`my-2 border-t ${dm ? 'border-gray-700' : 'border-gray-200'}`} />
        <div className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Tools</div>

        <NavBtn id="jdmatcher" label="JD Matcher" icon={FileSearch}
          badge={jdMatchResult ? (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${jdMatchResult.score >= 70 ? 'bg-green-100 text-green-700' : jdMatchResult.score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
              {jdMatchResult.score}%
            </span>
          ) : undefined}
        />
        <NavBtn id="ats" label="ATS Score" icon={Target} />
        <NavBtn id="styling" label="Styling" icon={Palette} />
        <NavBtn id="aisettings" label="AI Settings" icon={Bot} />
      </div>
      </div>
    </>
  );
};

export default Sidebar;
