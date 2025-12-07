
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, UserPlus, Settings, MessageSquare, 
  Search, AlertTriangle, X,
  Upload, Sun, Moon, Briefcase, 
  Download, ShieldAlert,
  Clock, LayoutDashboard, ClipboardList,
  CheckCircle2, UserX, CalendarDays,
  Copy, UserCheck, Percent, Lightbulb,
  Filter, Pencil, Trash2, Medal,
  Stethoscope, PauseCircle, Info, CloudLightning,
  Link as LinkIcon, CheckSquare, Flame, Sparkles,
  BarChart3, Activity, MailWarning, Eye, PieChart,
  Calendar, StickyNote, Gift, AlertOctagon, Wand2, Zap,
  FileSpreadsheet, Check, AlertCircle, Mail, HelpCircle,
  Database, FileQuestion, RefreshCcw, Save, Grid, List
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Employee, WorkStatus, Incident, ChatMessage, ShiftType, ShiftLogEntry, AttendanceStatus, DayOff, CoachingEntry } from './types';
import * as GeminiService from './services/geminiService';

// --- DATA SERVICE (CONEXIÓN NUBE DINÁMICA) ---
const DataService = {
  getApiUrl: () => localStorage.getItem('google_script_url') || '',
  
  setApiUrl: (url: string) => {
      const cleanUrl = url.trim();
      localStorage.setItem('google_script_url', cleanUrl);
      window.location.reload();
  },

  loadData: async (): Promise<{ employees: Employee[], logs: ShiftLogEntry[] }> => {
    const API_URL = localStorage.getItem('google_script_url');
    try {
      if(!API_URL) throw new Error("No URL configured");
      
      const response = await fetch(API_URL);
      const data = await response.json();
      return data;
    } catch (e) {
      console.warn("⚠️ Usando modo local offline (No URL o Error de Red).");
      const local = localStorage.getItem('pm_pro_data');
      return local ? JSON.parse(local) : { employees: [], logs: [] };
    }
  },
  
  saveData: async (employees: Employee[], logs: ShiftLogEntry[]) => {
    const API_URL = localStorage.getItem('google_script_url');
    try {
      const payload = { employees, logs, lastUpdated: new Date().toISOString() };
      localStorage.setItem('pm_pro_data', JSON.stringify(payload)); 

      if(API_URL) {
          await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
      }
    } catch (e) {
      console.error("Error guardando en nube:", e);
    }
  }
};

// --- HELPERS ---
const calculateReliability = (incidents: Incident[]): number => {
  let score = 100;
  incidents.forEach(inc => {
    switch(inc.type) {
      case 'Ausencia': score -= 15; break;
      case 'Tardanza': score -= 5; break;
      case 'Conducta': score -= 20; break;
      case 'Felicitacion': score += 5; break;
      default: break;
    }
  });
  return Math.max(0, Math.min(100, score));
};

const calculateProfileHealth = (emp: Employee): number => {
    let score = 0;
    const weights = {
        nombre: 10,
        cedula: 10,
        email: 15,
        cargo: 15,
        csAsignado: 15,
        fechaIngreso: 10,
        turno: 10,
        libranza: 15
    };

    if (emp.nombre) score += weights.nombre;
    if (emp.cedula) score += weights.cedula;
    if (emp.email && emp.email.includes('@')) score += weights.email;
    if (emp.cargo) score += weights.cargo;
    if (emp.csAsignado && emp.csAsignado !== 'Sin Asignar') score += weights.csAsignado;
    if (emp.fechaIngreso) score += weights.fechaIngreso;
    if (emp.turno) score += weights.turno;
    if (emp.libranza) score += weights.libranza;

    return score;
};

const getDayName = (dateStr: string): DayOff => {
  const date = new Date(dateStr + 'T12:00:00');
  const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  return days[date.getDay()] as DayOff;
};

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getSeniority = (dateStr: string) => {
    if(!dateStr) return 'Reciente';
    const start = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)); 
    if(diffDays < 30) return `${diffDays}d`;
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    let result = '';
    if(years > 0) result += `${years}a `;
    if(months > 0) result += `${months}m`;
    return result || '1m';
};

const DAYS_OPTIONS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

// --- COMPONENTS ---
const Modal = ({ title, onClose, children, maxWidth = "max-w-lg" }: { title: string, onClose: () => void, children?: React.ReactNode, maxWidth?: string }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
    <div className={`glass-panel w-full ${maxWidth} rounded-2xl p-6 relative bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto max-h-[90vh]`}>
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 transition-colors bg-slate-100 dark:bg-slate-800 rounded-full p-1"><X size={20} /></button>
      <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">{title}</h2>
      {children}
    </div>
  </div>
);

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'}`}>
    <Icon size={18} /><span className="hidden sm:inline">{label}</span>
  </button>
);

const StatCard = ({ title, value, sub, icon: Icon, color, onClick }: any) => {
  const IconComp = Icon || Info;
  return (
    <div onClick={onClick} className={`glass-panel p-5 rounded-2xl relative overflow-hidden group hover:translate-y-[-4px] transition-transform duration-300 ${onClick ? 'cursor-pointer' : ''}`}>
      <div className={`absolute right-[-10px] top-[-10px] p-6 opacity-5 group-hover:opacity-10 transition-opacity ${color}`}><IconComp size={80} /></div>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</p>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{value}</h2>
          {sub && <p className={`text-xs mt-1 font-medium ${color.replace('text-', 'text-')}`}>{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl bg-slate-100 dark:bg-slate-800 ${color}`}><IconComp size={24} /></div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [loadingData, setLoadingData] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftLogs, setShiftLogs] = useState<ShiftLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'control' | 'directory' | 'logs' | 'analytics' | 'monthly'>('control');
  const [darkMode, setDarkMode] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [compactMode, setCompactMode] = useState(false); // False = Normal Grid Mode
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState('');
  const [focusMode, setFocusMode] = useState(false);

  // Plus Features State
  const [stickyNote, setStickyNote] = useState(localStorage.getItem('pm_sticky_note') || '');

  // Modals & UI
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeTab, setEmployeeTab] = useState<'info' | 'coaching' | 'calendar'>('info');
  const [showChat, setShowChat] = useState(false);
  
  // Import Logic State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<Employee[]>([]);
  const [showUploadLegend, setShowUploadLegend] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkStatus | 'All'>('Activo');
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
  const [showRiskOnly, setShowRiskOnly] = useState(false);
  const [showIncompleteData, setShowIncompleteData] = useState(false);
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Log Logic
  const [logInput, setLogInput] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (localStorage.getItem('theme') === 'light') { setDarkMode(false); document.documentElement.classList.remove('dark'); }
    else { setDarkMode(true); document.documentElement.classList.add('dark'); }

    const url = localStorage.getItem('google_script_url');
    if (!url) setShowConfigModal(true);

    const initData = async () => {
        setLoadingData(true);
        const data = await DataService.loadData();
        if (data.employees) setEmployees(data.employees.map(e => ({...e, coachingHistory: e.coachingHistory || [], attendanceHistory: e.attendanceHistory || {}, incidents: e.incidents || []})));
        if (data.logs) setShiftLogs(data.logs);
        setLoadingData(false);
    };
    initData();
  }, []);

  const persistChanges = (newEmployees: Employee[], newLogs: ShiftLogEntry[]) => {
    setEmployees(newEmployees);
    setShiftLogs(newLogs);
    DataService.saveData(newEmployees, newLogs);
  };

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  };

  // --- DATA PROCESSING ---
  const activeEmployees = useMemo(() => employees.filter(e => e.statusLaboral === 'Activo'), [employees]);
  const exitEmployees = useMemo(() => employees.filter(e => e.statusLaboral === 'Egreso'), [employees]);
  
  const duplicateMap = useMemo(() => { 
    const counts: Record<string, number> = {}; 
    employees.forEach(e => { if(e.statusLaboral === 'Activo') counts[e.cedula] = (counts[e.cedula] || 0) + 1; }); 
    return counts; 
  }, [employees]);

  const csDuplicateMap = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(e => {
        if(e.statusLaboral === 'Activo' && e.csAsignado && e.csAsignado !== 'Sin Asignar') {
            const key = `${e.turno}-${e.csAsignado.toLowerCase().trim()}`;
            counts[key] = (counts[key] || 0) + 1;
        }
    });
    return counts;
  }, [employees]);

  const dailyStats = useMemo(() => {
    const dayOfWeek = getDayName(selectedDate);
    const convocados = activeEmployees.filter(e => e.libranza !== dayOfWeek);
    const libres = activeEmployees.filter(e => e.libranza === dayOfWeek);
    let presentes = 0, tardanzas = 0, faltas = 0, medical = 0, pnr = 0;

    convocados.forEach(e => {
        const status = e.attendanceHistory?.[selectedDate];
        if (status === 'Presente') presentes++;
        if (status === 'Tardanza') { presentes++; tardanzas++; }
        if (status === 'Falta') faltas++;
        if (status === 'Medical') medical++;
        if (status === 'PNR') pnr++;
    });

    const workingTotal = convocados.length - (medical + pnr);
    const efe = workingTotal > 0 ? Math.round((presentes / workingTotal) * 100) : 0;
    const ia = workingTotal > 0 ? Math.round((faltas / workingTotal) * 100) : 0;
    
    return { totalConvocados: convocados.length, presentes, tardanzas, faltas, medical, pnr, efe, ia, libres, convocadosList: convocados };
  }, [activeEmployees, selectedDate]);

  const monthlyData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = getDaysInMonth(year, month - 1);
    const days = Array.from({ length: daysInMonth }, (_, i) => {
        const d = new Date(year, month - 1, i + 1);
        return {
            dateStr: d.toISOString().split('T')[0],
            dayNum: i + 1,
            dayName: d.toLocaleDateString('es-ES', { weekday: 'narrow' }), // L, M, X...
            dayWeek: getDayName(d.toISOString().split('T')[0])
        };
    });
    return { days, year, month };
  }, [selectedMonth]);

  const monthlyPatterns = useMemo(() => {
      const patterns: string[] = [];
      const absencesByDay: Record<string, number> = {};
      activeEmployees.forEach(emp => {
          let empAbsences = 0;
          monthlyData.days.forEach(d => {
              if(emp.attendanceHistory?.[d.dateStr] === 'Falta') {
                  absencesByDay[d.dayWeek] = (absencesByDay[d.dayWeek] || 0) + 1;
                  empAbsences++;
              }
          });
          if(empAbsences >= 3) patterns.push(`⚠️ ${emp.nombre} tiene ${empAbsences} faltas en ${selectedMonth}.`);
      });
      const maxAbsenceDay = Object.keys(absencesByDay).reduce((a, b) => absencesByDay[a] > absencesByDay[b] ? a : b, 'LUNES');
      if(absencesByDay[maxAbsenceDay] > 5) patterns.push(`📉 Tendencia: Mayor ausentismo los días ${maxAbsenceDay}.`);
      return patterns.slice(0, 3);
  }, [activeEmployees, monthlyData, selectedMonth]);

  const upcomingAnniversaries = useMemo(() => {
      const currentMonth = new Date().getMonth();
      return activeEmployees.filter(e => {
          if(!e.fechaIngreso) return false;
          return new Date(e.fechaIngreso).getMonth() === currentMonth;
      });
  }, [activeEmployees]);

  const retentionRate = useMemo(() => {
    if (employees.length === 0) return 0;
    const totalActive = activeEmployees.length;
    const totalExits = exitEmployees.length;
    const totalBase = totalActive + totalExits;
    return totalBase > 0 ? Math.round((totalActive / totalBase) * 100) : 100;
  }, [activeEmployees, exitEmployees, employees]);

  const daysOffDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    DAYS_OPTIONS.forEach(day => counts[day] = 0);
    activeEmployees.forEach(e => { if (counts[e.libranza] !== undefined) counts[e.libranza]++; });
    return Object.keys(counts).map(day => ({ name: day.substring(0, 3), full: day, count: counts[day] }));
  }, [activeEmployees]);

  const staffingAnalysis = useMemo(() => {
     const counts: Record<string, number> = { LUNES:0, MARTES:0, MIERCOLES:0, JUEVES:0, VIERNES:0, SABADO:0, DOMINGO:0 };
     activeEmployees.forEach(e => { if(counts[e.libranza] !== undefined) counts[e.libranza]++; });
     const days = Object.keys(counts);
     const maxDay = days.reduce((a, b) => counts[a] > counts[b] ? a : b);
     const minDay = days.reduce((a, b) => counts[a] < counts[b] ? a : b);
     const avg = activeEmployees.length / 7;
     let recommendation = "Balance de días libres óptimo.";
     let type: 'ok' | 'warn' = 'ok';
     if (counts[maxDay] > avg + 2) { recommendation = `Alerta: Exceso de libres el ${maxDay} (${counts[maxDay]}). Mover a ${minDay}.`; type = 'warn'; }
     return { recommendation, type };
  }, [activeEmployees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (showOnlyDuplicates) return duplicateMap[emp.cedula] > 1;
      if (showRiskOnly) return emp.reliabilityScore < 90 && emp.statusLaboral === 'Activo';
      if (showIncompleteData) return calculateProfileHealth(emp) < 100 && emp.statusLaboral === 'Activo';
      if (statusFilter !== 'All' && emp.statusLaboral !== statusFilter) return false;
      const searchLower = searchTerm.toLowerCase();
      return (emp.nombre.toLowerCase().includes(searchLower) || emp.cedula.includes(searchLower) || emp.csAsignado.toLowerCase().includes(searchLower) || (emp.cargo||'').toLowerCase().includes(searchLower));
    });
  }, [employees, statusFilter, searchTerm, showOnlyDuplicates, duplicateMap, showRiskOnly, showIncompleteData]);

  const monthProgress = useMemo(() => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return Math.round((today.getDate() / daysInMonth) * 100);
  }, []);
  
  const dataQualityScore = useMemo(() => {
      if(activeEmployees.length === 0) return 0;
      const totalHealth = activeEmployees.reduce((sum, emp) => sum + calculateProfileHealth(emp), 0);
      return Math.round(totalHealth / activeEmployees.length);
  }, [activeEmployees]);

  // --- HANDLERS ---
  const handleMassAttendance = () => {
    const targets = dailyStats.convocadosList.filter(e => !e.attendanceHistory?.[selectedDate]);
    if(targets.length === 0) return alert("Todos los convocados ya tienen asistencia marcada.");
    if(!confirm(`¿Marcar a ${targets.length} empleados como PRESENTES?`)) return;
    const newEmployees = employees.map(e => {
      const isTarget = targets.find(t => t.id === e.id);
      if(isTarget) return { ...e, attendanceHistory: { ...e.attendanceHistory, [selectedDate]: 'Presente' as AttendanceStatus } };
      return e;
    });
    persistChanges(newEmployees, shiftLogs);
  };

  const handleAutoFillLibranzas = () => {
    const dayOfWeek = getDayName(selectedDate);
    const libresToday = activeEmployees.filter(e => e.libranza === dayOfWeek && !e.attendanceHistory?.[selectedDate]);
    if(libresToday.length === 0) return alert("No hay empleados pendientes de marcar Libre para hoy.");
    const newEmployees = employees.map(e => {
        if (e.statusLaboral === 'Activo' && e.libranza === dayOfWeek && !e.attendanceHistory?.[selectedDate]) {
            return { ...e, attendanceHistory: { ...e.attendanceHistory, [selectedDate]: 'Libre' as AttendanceStatus } };
        }
        return e;
    });
    persistChanges(newEmployees, shiftLogs);
    showToast(`🪄 ${libresToday.length} Libres marcados`);
  };

  const generateAmonestacion = (emp: Employee) => {
    const text = `Buenas tardes.
Saludos cordiales.

Me dirijo en esta oportunidad para solicitar amonestación para el siguiente colaborador: 

- Colaborador: ${emp.nombre}
- Cargo: ${emp.cargo || 'N/A'}
- Cedula: ${emp.cedula}
- Fecha: ${selectedDate}
- Motivo: Ausencia Injustificada
- Turno: ${emp.turno}
- Supervisor: ${emp.csAsignado || 'Sin Asignar'}`;
    navigator.clipboard.writeText(text).then(() => showToast("📋 Solicitud Copiada")).catch(() => alert("❌ Error al copiar."));
  };

  const generateLogSummary = () => {
    const summary = `📝 BITÁCORA - ${selectedDate}\n\n🔹 OPERATIVA\n- Convocados: ${dailyStats.totalConvocados}\n- Presentes: ${dailyStats.presentes} (${dailyStats.efe}%)\n- Tardanzas: ${dailyStats.tardanzas}\n- Ausencias: ${dailyStats.faltas} (${dailyStats.ia}%)\n- Justificados: ${dailyStats.medical + dailyStats.pnr}\n\n🔸 NOVEDADES\n- [Escribir aquí incidencias relevantes...]\n- [Escribir aquí pendientes...]\n\n✅ Cierre de turno sin novedad mayor.`;
    setLogInput(summary);
  };

  const handleStickyNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value; setStickyNote(val); localStorage.setItem('pm_sticky_note', val);
  };

  const handleAttendance = (id: string, status: AttendanceStatus) => {
    const newEmployees = employees.map(e => e.id === id ? { ...e, attendanceHistory: { ...e.attendanceHistory, [selectedDate]: status } } : e);
    persistChanges(newEmployees, shiftLogs);
  };

  const generateReport = async () => {
    const { totalConvocados, presentes, tardanzas, faltas, medical, pnr, efe, ia, libres } = dailyStats;
    const report = `📊 *REPORTE ${selectedDate}*\n👥 Conv: ${totalConvocados} | ✅ Asist: ${presentes}\n⚠️ Tard: ${tardanzas} | ❌ Falta: ${faltas}\n🏥 Med: ${medical} | 🔵 PNR: ${pnr}\n📈 EFE: ${efe}% | IA: ${ia}%\n🏝 Libres: ${libres.length}`;
    try { await navigator.clipboard.writeText(report); showToast("✅ Reporte Copiado"); } catch (err) { alert('❌ Error copiando.'); }
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Nombre", "Cargo", "Cedula", "Turno", "Libre", "Ingreso", "CS Asignado", "Score", "Estado", "Salud Perfil"];
    const rows = filteredEmployees.map(e => [e.id, e.nombre, e.cargo, e.cedula, e.turno, e.libranza, e.fechaIngreso, e.csAsignado, e.reliabilityScore, e.statusLaboral, calculateProfileHealth(e) + '%']);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `PM_PRO_DATA.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleExportMonthly = () => {
    const headers = ["Empleado", "Cargo", "Turno", "Supervisor", ...monthlyData.days.map(d => `${d.dayNum}/${d.dayName}`)];
    const rows = activeEmployees.map(emp => {
        const attendance = monthlyData.days.map(d => {
            const isLibranza = d.dayWeek === emp.libranza;
            const status = emp.attendanceHistory?.[d.dateStr];
            return status || (isLibranza ? 'Libre' : '');
        });
        return [emp.nombre, emp.cargo || '', emp.turno, emp.csAsignado, ...attendance].map(c => `"${c}"`);
    });
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");
        
    const link = document.createElement("a"); 
    link.setAttribute("href", encodeURI(csvContent)); 
    link.setAttribute("download", `REPORTE_MENSUAL_${selectedMonth}.csv`);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
  };

  // --- SMART IMPORT LOGIC ---
  const handleDownloadTemplate = () => {
      const headers = ["Nombre Completo", "Cedula", "Correo", "Fecha Ingreso (YYYY-MM-DD)", "Mesa (Opcional)", "Turno (AM/PM)", "Dia Libre", "CS Asignado", "Cargo (Opcional)"];
      const example = ["Juan Perez", "12345678", "juan@email.com", "2024-01-01", "", "PM", "DOMINGO", "Maria Lopez", "Agente"];
      const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + example.join(",");
      const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `PLANTILLA_IMPORTACION.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const processImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const newEmps: Employee[] = [];
        
        lines.forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine) return;
            // Handle both comma and semicolon
            const p = cleanLine.split(/[,;]/).map(x => x.trim().replace(/^"|"$/g, ''));
            
            // Basic validation: Name and Cedula required
            if (p.length < 2 || p[0].toLowerCase().includes('nombre') || !p[1]) return;

            const turno = (p[5] || 'PM').toUpperCase() === 'AM' ? 'AM' : 'PM';
            const libranza = (p[6] || 'DOMINGO').toUpperCase() as DayOff;

            newEmps.push({
                id: crypto.randomUUID(),
                nombre: p[0],
                cedula: p[1],
                email: p[2] || '',
                fechaIngreso: p[3] || new Date().toISOString().split('T')[0],
                turno: turno,
                libranza: DAYS_OPTIONS.includes(libranza) ? libranza : 'DOMINGO',
                csAsignado: p[7] || 'Sin Asignar',
                cargo: p[8] || 'Agente',
                reliabilityScore: 100,
                statusLaboral: 'Activo',
                statusHistory: [], incidents: [], coachingHistory: [], attendanceHistory: {}
            });
        });
        setImportPreviewData(newEmps);
        setShowImportModal(true);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmImport = () => {
      persistChanges([...employees, ...importPreviewData], shiftLogs);
      setShowImportModal(false);
      setImportPreviewData([]);
      showToast(`✅ Importados ${importPreviewData.length} registros`);
  };

  const handleClearAllEmployees = () => {
    if(confirm("⚠️ PELIGRO: ¿Estás seguro de que deseas borrar TODA la base de datos de empleados?\n\nEsta acción no se puede deshacer y se usa para cargar una nómina limpia.")) {
        persistChanges([], shiftLogs); // Keep logs, clear employees
        showToast("🗑️ Base de Datos Limpiada");
    }
  };

  // --- CRUD & MISC ---
  const handleAddEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const cedula = fd.get('cedula') as string;
    if (duplicateMap[cedula] && !confirm('Cédula duplicada. ¿Registrar?')) return;
    const newEmp: Employee = { id: crypto.randomUUID(), nombre: fd.get('nombre') as string, cedula: cedula, cargo: fd.get('cargo') as string || 'Agente', email: fd.get('email') as string, fechaIngreso: fd.get('fechaIngreso') as string, turno: fd.get('turno') as ShiftType, libranza: fd.get('libranza') as any, csAsignado: fd.get('csAsignado') as string, statusLaboral: 'Activo', statusHistory: [], incidents: [], coachingHistory: [], attendanceHistory: {}, reliabilityScore: 100 };
    persistChanges([...employees, newEmp], shiftLogs); setShowAddModal(false);
  };

  const handleUpdateEmployee = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault(); const fd = new FormData(e.currentTarget); if (!editingEmployeeId) return;
      const updated = employees.map(emp => emp.id === editingEmployeeId ? { ...emp, nombre: fd.get('nombre') as string, cedula: fd.get('cedula') as string, cargo: fd.get('cargo') as string, email: fd.get('email') as string, turno: fd.get('turno') as ShiftType, libranza: fd.get('libranza') as any, csAsignado: fd.get('csAsignado') as string, fechaIngreso: fd.get('fechaIngreso') as string, fechaFin: fd.get('fechaFin') ? fd.get('fechaFin') as string : undefined } : emp);
      persistChanges(updated, shiftLogs); showToast("💾 Datos Actualizados");
  };

  const handleDeleteEmployee = () => { if(editingEmployeeId && confirm('¿Eliminar?')) { persistChanges(employees.filter(e => e.id !== editingEmployeeId), shiftLogs); setEditingEmployeeId(null); } };

  const handleAddCoaching = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); if (!editingEmployeeId) return; const fd = new FormData(e.currentTarget); const newCoaching: CoachingEntry = { id: crypto.randomUUID(), date: fd.get('date') as string, topic: fd.get('topic') as any, notes: fd.get('notes') as string, actionItems: fd.get('actionItems') as string, status: 'Pendiente' }; const updated = employees.map(emp => emp.id === editingEmployeeId ? { ...emp, coachingHistory: [newCoaching, ...(emp.coachingHistory || [])] } : emp); persistChanges(updated, shiftLogs); (e.target as HTMLFormElement).reset(); alert('Guardado.'); };
  const handleAddIncident = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); if (!showIncidentModal) return; const fd = new FormData(e.currentTarget); const newInc: Incident = { id: crypto.randomUUID(), type: fd.get('type') as any, date: fd.get('date') as string, note: fd.get('note') as string, severity: 'Medium' }; const updated = employees.map(emp => emp.id === showIncidentModal ? { ...emp, incidents: [...emp.incidents, newInc], reliabilityScore: calculateReliability([...emp.incidents, newInc]) } : emp); persistChanges(updated, shiftLogs); setShowIncidentModal(null); };
  const handleStatusChange = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); if (!showStatusModal) return; const fd = new FormData(e.currentTarget); const ns = fd.get('status') as WorkStatus; const updated = employees.map(emp => emp.id === showStatusModal ? { ...emp, statusLaboral: ns, fechaFin: ns === 'Egreso' ? fd.get('date') as string : undefined } : emp); persistChanges(updated, shiftLogs); setShowStatusModal(null); };
  
  // LOGS MANIPULATION
  const handleAddLog = () => { 
      if (!logInput.trim()) return; 
      
      if (editingLogId) {
          // Update Existing
          const updatedLogs = shiftLogs.map(log => log.id === editingLogId ? { ...log, text: logInput, timestamp: new Date().toLocaleString() + ' (Edit)' } : log);
          persistChanges(employees, updatedLogs);
          setEditingLogId(null);
          setLogInput('');
          showToast("✏️ Bitácora Actualizada");
      } else {
          // Create New
          const newLog: ShiftLogEntry = { id: crypto.randomUUID(), timestamp: new Date().toLocaleString(), text: logInput, author: 'Sup' }; 
          persistChanges(employees, [newLog, ...shiftLogs]); 
          setLogInput('');
          showToast("📝 Nota Guardada");
      }
  };

  const handleEditLog = (log: ShiftLogEntry) => {
      setLogInput(log.text);
      setEditingLogId(log.id);
      // Scroll to top of logs area usually helpful, but sticking to logic update
  };

  const handleDeleteLog = (id: string) => {
      if(confirm("¿Borrar esta nota de la bitácora?")) {
          const filteredLogs = shiftLogs.filter(l => l.id !== id);
          persistChanges(employees, filteredLogs);
      }
  };
  
  const handleChat = async (e: React.FormEvent) => { e.preventDefault(); if (!chatInput.trim()) return; const userMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: new Date() }; setChatHistory(p => [...p, userMsg]); setChatInput(''); setIsChatLoading(true); const context = JSON.stringify(activeEmployees.slice(0, 20).map(e => ({ n:e.nombre, s:e.reliabilityScore }))); const res = await GeminiService.sendChatMessage(chatHistory, userMsg.text, context); setChatHistory(p => [...p, { role: 'model', text: res, timestamp: new Date() }]); setIsChatLoading(false); };
  
  const showToast = (msg: string) => { const t=document.createElement("div"); t.className="fixed bottom-5 right-5 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-xl text-sm font-bold z-50 animate-bounce"; t.innerText=msg; document.body.appendChild(t); setTimeout(()=>document.body.removeChild(t),3000); };

  if (loadingData) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white"><div className="animate-pulse flex flex-col items-center gap-4"><CloudLightning size={48} className="text-indigo-500 animate-bounce"/><span className="text-xl font-bold">Conectando...</span></div></div>;

  return (
    <div className="min-h-screen pb-20 font-sans selection:bg-indigo-500 selection:text-white">
      <header className="glass-panel sticky top-0 z-40 border-b border-white/10 dark:border-white/5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-lg"><ShieldAlert className="text-white" size={24} /></div>
            <div><h1 className="text-xl font-bold text-slate-800 dark:text-white">PM <span className="text-indigo-500">Pro</span></h1><p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1"><CloudLightning size={10} className="text-emerald-500"/> Cloud v7.3</p></div>
          </div>
          <nav className="hidden md:flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl">
            <TabButton active={activeTab === 'control'} onClick={() => setActiveTab('control')} icon={LayoutDashboard} label="Control" />
            <TabButton active={activeTab === 'monthly'} onClick={() => setActiveTab('monthly')} icon={Calendar} label="Mensual" />
            <TabButton active={activeTab === 'directory'} onClick={() => setActiveTab('directory')} icon={Users} label="Directorio" />
            <TabButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon={PieChart} label="Analítica" />
            <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={ClipboardList} label="Bitácora" />
          </nav>
          <div className="flex gap-2">
             <button onClick={() => setShowConfigModal(true)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500"><LinkIcon size={18}/></button>
             <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {activeTab === 'control' && (
           <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-6">
                      <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                          <div className="flex items-center gap-4 w-full sm:w-auto"><div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-500"><CalendarDays size={24} /></div><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-transparent text-xl font-bold text-slate-800 dark:text-white outline-none w-full sm:w-auto"/></div>
                          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex flex-col"><span className="text-[10px] font-bold uppercase text-slate-500">Mes en curso</span><span className="text-sm font-bold text-indigo-500">{monthProgress}% completado</span></div>
                            <div className="w-20 h-2 bg-slate-300 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{width: `${monthProgress}%`}}></div></div>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button onClick={handleAutoFillLibranzas} className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-slate-800 dark:text-indigo-400 dark:hover:bg-slate-700 font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors" title="Autocompletar Libres"><Wand2 size={16} /></button>
                            <button onClick={handleMassAttendance} className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:bg-indigo-500 transition-colors"><CheckSquare size={16} /> Masiva</button>
                            <button onClick={generateReport} className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:bg-emerald-500 transition-colors"><Copy size={16} /> Reporte</button>
                          </div>
                      </div>
                      
                      {upcomingAnniversaries.length > 0 && (
                          <div className="glass-panel p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-center gap-3 animate-fade-in"><Gift size={20} className="text-indigo-500" /><div className="flex-1 overflow-hidden"><p className="text-xs font-bold text-indigo-500 uppercase">Aniversarios este mes</p><div className="flex gap-2 overflow-x-auto no-scrollbar">{upcomingAnniversaries.map(e => (<span key={e.id} className="text-xs whitespace-nowrap bg-white/50 dark:bg-slate-800 px-2 rounded-md">{e.nombre} ({getSeniority(e.fechaIngreso)})</span>))}</div></div></div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                        <StatCard title="Conv" value={dailyStats.totalConvocados} icon={Users} color="text-indigo-500" />
                        <StatCard title="Asist" value={dailyStats.presentes} icon={UserCheck} color="text-emerald-500" />
                        <StatCard title="Tard" value={dailyStats.tardanzas} icon={Clock} color="text-amber-500" />
                        <StatCard title="Falta" value={dailyStats.faltas} icon={UserX} color="text-rose-500" />
                        <StatCard title="Med" value={dailyStats.medical} icon={Stethoscope} color="text-purple-500" />
                        <StatCard title="PNR" value={dailyStats.pnr} icon={PauseCircle} color="text-blue-500" />
                        <div className="glass-panel p-2 flex flex-col justify-center items-center"><h3 className="text-2xl font-bold text-indigo-500">{dailyStats.efe}%</h3><p className="text-[10px] font-bold">EFE</p></div>
                        <div className="glass-panel p-2 flex flex-col justify-center items-center"><h3 className="text-2xl font-bold text-rose-500">{dailyStats.ia}%</h3><p className="text-[10px] font-bold">IA</p></div>
                      </div>
                      
                      <div className={`glass-panel p-4 rounded-xl border-l-4 ${staffingAnalysis.type === 'warn' ? 'border-amber-500 bg-amber-500/5' : 'border-emerald-500 bg-emerald-500/5'} flex gap-3`}><Lightbulb size={24} className={staffingAnalysis.type==='warn'?'text-amber-500':'text-emerald-500'}/><p className="text-sm">{staffingAnalysis.recommendation}</p></div>

                      <div className="glass-panel p-4 rounded-2xl">
                          <div className="flex justify-between items-center mb-4">
                              <h3 className="font-bold flex gap-2"><UserCheck size={18} className="text-emerald-500"/> Asistencia</h3>
                              <div className="flex gap-4 items-center">
                                {/* LEGEND BAR */}
                                <div className="hidden lg:flex gap-3 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[10px] font-bold text-slate-500">PRESENTE</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div><span className="text-[10px] font-bold text-slate-500">TARDANZA</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="text-[10px] font-bold text-slate-500">FALTA</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500"></div><span className="text-[10px] font-bold text-slate-500">MÉDICO</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-[10px] font-bold text-slate-500">PNR</span></div>
                                </div>
                                <button onClick={() => setCompactMode(!compactMode)} className="text-xs border border-slate-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    {compactMode ? <List size={12}/> : <Grid size={12}/>} 
                                    {compactMode ? 'Vista: Lista' : 'Vista: Cuadrícula'}
                                </button>
                              </div>
                          </div>
                          
                          <div className={`grid gap-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar ${compactMode ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}`}>
                              {dailyStats.convocadosList.map(emp => {
                                  const status = emp.attendanceHistory?.[selectedDate];
                                  
                                  if (!compactMode) {
                                      // DETAIL CARD VIEW (GRID)
                                      return (
                                          <div key={emp.id} className={`glass-panel p-4 rounded-xl flex flex-col gap-3 relative border-l-4 transition-all duration-300 ${status==='Presente'?'border-emerald-500':status==='Falta'?'border-rose-500':status==='Tardanza'?'border-amber-500':status==='Medical'?'border-purple-500':status==='PNR'?'border-blue-500':'border-transparent'}`}>
                                              <div className="flex justify-between items-start">
                                                  <div className="flex items-center gap-3">
                                                      <div className={`w-10 h-10 rounded-full flex justify-center items-center font-bold text-white shadow-md ${status==='Presente'?'bg-emerald-500':status==='Falta'?'bg-rose-500':status==='Tardanza'?'bg-amber-500':status==='Medical'?'bg-purple-500':status==='PNR'?'bg-blue-500':'bg-slate-400'}`}>
                                                          {status==='Medical'?<Stethoscope size={16}/>:status==='PNR'?<PauseCircle size={16}/>:emp.nombre.charAt(0)}
                                                      </div>
                                                      <div>
                                                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[140px]" title={emp.nombre}>{emp.nombre} {emp.reliabilityScore === 100 && <Flame size={12} className="inline text-amber-500 fill-amber-500" />}</h4>
                                                          <div className="text-[10px] text-slate-500 flex flex-col">
                                                              <span>ID: {emp.cedula}</span>
                                                              <span className="truncate max-w-[120px]" title={emp.csAsignado}>CS: {emp.csAsignado || 'N/A'}</span>
                                                          </div>
                                                      </div>
                                                  </div>
                                                  {status === 'Falta' && (<button onClick={() => generateAmonestacion(emp)} className="text-[10px] bg-rose-500/10 text-rose-500 px-2 py-1 rounded hover:bg-rose-500 hover:text-white transition-colors" title="Reportar"><MailWarning size={14}/></button>)}
                                              </div>
                                              
                                              <div className="mt-auto grid grid-cols-5 gap-1 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                                  {['Presente','Tardanza','Falta','Medical','PNR'].map(s=>(
                                                      <button key={s} onClick={()=>handleAttendance(emp.id, s as any)} className={`h-8 rounded-lg flex items-center justify-center transition-all ${status===s ? 'ring-2 ring-offset-1 dark:ring-offset-slate-800 ring-offset-white scale-105' : 'hover:scale-105 opacity-50 hover:opacity-100'} ${s==='Presente'?'bg-emerald-500 text-white':s==='Tardanza'?'bg-amber-500 text-white':s==='Falta'?'bg-rose-500 text-white':s==='Medical'?'bg-purple-500 text-white':'bg-blue-500 text-white'}`} title={s}>
                                                          {s==='Presente'?<Check size={14}/>:s==='Tardanza'?<Clock size={14}/>:s==='Falta'?<UserX size={14}/>:s==='Medical'?<Stethoscope size={14}/>:<PauseCircle size={14}/>}
                                                      </button>
                                                  ))}
                                              </div>
                                          </div>
                                      );
                                  }

                                  // COMPACT LIST VIEW
                                  return (
                                      <div key={emp.id} className="flex justify-between items-center rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 transition-all p-2">
                                          <div className="flex items-center gap-3">
                                              <div className={`rounded-full flex justify-center items-center text-white font-bold transition-all shadow-md w-8 h-8 text-xs ${status==='Presente'?'bg-emerald-500':status==='Falta'?'bg-rose-500':status==='Tardanza'?'bg-amber-500':status==='Medical'?'bg-purple-500':status==='PNR'?'bg-blue-500':'bg-slate-400'}`}>
                                                  {status==='Medical'?<Stethoscope size={14}/>:status==='PNR'?<PauseCircle size={14}/>:emp.nombre.charAt(0)}
                                              </div>
                                              <div>
                                                  <div className="font-bold flex items-center gap-2 text-slate-800 dark:text-white text-xs">{emp.nombre} {emp.reliabilityScore === 100 && <Flame size={12} className="text-amber-500 fill-amber-500" />}</div>
                                              </div>
                                          </div>
                                          <div className="flex gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-100 dark:border-slate-700/50 shadow-sm">
                                            {['Presente','Tardanza','Falta','Medical','PNR'].map(s=>(<button key={s} onClick={()=>handleAttendance(emp.id, s as any)} className={`relative p-1.5 rounded-md transition-all duration-200 hover:scale-110 group ${status===s ? 'bg-slate-100 dark:bg-slate-800 ring-1 ring-black/5 dark:ring-white/10 shadow-inner' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}><div className={`w-2.5 h-2.5 rounded-full transition-all ${s==='Presente'?'bg-emerald-500':s==='Tardanza'?'bg-amber-500':s==='Falta'?'bg-rose-500':s==='Medical'?'bg-purple-500':'bg-blue-500'} ${status===s ? 'scale-125 ring-2 ring-offset-1 dark:ring-offset-slate-800 ring-offset-white' : 'opacity-40 hover:opacity-100'}`}></div></button>))}
                                          </div>
                                      </div>
                                  )
                              })}
                          </div>
                      </div>
                  </div>
                  <div className="w-full md:w-64 space-y-6">
                      <div className="glass-panel p-4 rounded-2xl flex flex-col"><h3 className="font-bold mb-3 flex gap-2"><Briefcase size={18}/> Libres ({dailyStats.libres.length})</h3><div className="flex-1 overflow-y-auto space-y-2 max-h-64">{dailyStats.libres.map(e => (<div key={e.id} className="p-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold flex gap-2"><div className="w-5 h-5 bg-slate-300 dark:bg-slate-600 rounded-full flex justify-center items-center">{e.nombre.charAt(0)}</div>{e.nombre}</div>))}</div></div>
                      <div className="glass-panel p-4 rounded-2xl bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/30"><h3 className="font-bold mb-2 flex gap-2 text-yellow-600 dark:text-yellow-500 text-sm"><StickyNote size={16}/> Notas Rápidas</h3><textarea value={stickyNote} onChange={handleStickyNoteChange} className="w-full h-32 bg-transparent resize-none outline-none text-sm text-slate-700 dark:text-slate-300 placeholder-yellow-500/50" placeholder="Recordatorios..."></textarea></div>
                  </div>
              </div>
           </div>
        )}

        {/* --- VIEW: MONTHLY PERSPECTIVE --- */}
        {activeTab === 'monthly' && (
            <div className="space-y-6 animate-fade-in">
                <div className="glass-panel p-4 rounded-xl flex justify-between items-center">
                    <div className="flex items-center gap-4"><Calendar size={24} className="text-indigo-500" /><input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent text-xl font-bold text-slate-800 dark:text-white outline-none"/></div>
                    <div className="flex gap-2">
                        <button onClick={() => setFocusMode(!focusMode)} className={`px-4 py-2 rounded-lg font-bold text-sm flex gap-2 transition-colors ${focusMode ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}><Zap size={16}/> {focusMode ? 'Modo Enfoque: ON' : 'Modo Enfoque'}</button>
                        {monthlyPatterns.length > 0 && (<div className="group relative"><button className="p-2 bg-amber-500/20 text-amber-500 rounded-lg animate-pulse"><AlertOctagon size={20}/></button><div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 p-3 rounded-lg shadow-xl z-50 text-xs text-white hidden group-hover:block"><p className="font-bold mb-2 border-b border-white/10 pb-1">Patrones Detectados:</p><ul className="list-disc pl-4 space-y-1">{monthlyPatterns.map((p, i) => <li key={i}>{p}</li>)}</ul></div></div>)}
                        <button onClick={handleExportMonthly} className="px-4 py-2 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-lg font-bold text-sm flex gap-2"><Download size={16}/> Exportar Mes</button>
                    </div>
                </div>
                <div className="glass-panel p-0 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-800"><tr><th className="px-4 py-3 text-left font-bold sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 shadow-md">Empleado</th>{monthlyData.days.map(d => (<th key={d.dayNum} className={`px-1 py-3 text-center min-w-[30px] ${d.dayName === 'S' || d.dayName === 'D' ? 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-400' : ''}`}><div className="font-bold">{d.dayNum}</div><div className="text-[10px] opacity-60">{d.dayName}</div></th>))}</tr></thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                {activeEmployees.map(emp => (
                                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="px-4 py-2 font-bold sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-200 dark:border-slate-700 shadow-sm truncate max-w-[150px]">{emp.nombre}</td>
                                        {monthlyData.days.map(d => {
                                            const isLibranza = d.dayWeek === emp.libranza;
                                            const recordedStatus = emp.attendanceHistory?.[d.dateStr];
                                            const displayStatus = recordedStatus || (isLibranza ? 'Libre' : undefined);
                                            let bgClass = ''; let opacityClass = '';
                                            if (displayStatus === 'Presente') bgClass = 'bg-emerald-500'; else if (displayStatus === 'Falta') bgClass = 'bg-rose-500'; else if (displayStatus === 'Tardanza') bgClass = 'bg-amber-500'; else if (displayStatus === 'Medical') bgClass = 'bg-purple-500'; else if (displayStatus === 'PNR') bgClass = 'bg-blue-500'; else if (displayStatus === 'Libre') bgClass = 'bg-slate-400 dark:bg-slate-600'; 
                                            if (focusMode) { if (displayStatus === 'Falta' || displayStatus === 'Tardanza' || displayStatus === 'Medical') { opacityClass = 'opacity-100 scale-110 shadow-lg shadow-rose-500/50 z-10'; } else { opacityClass = 'opacity-10 grayscale'; } } else { if (displayStatus === 'Libre') opacityClass = 'opacity-30'; }
                                            const isWeekend = d.dayName === 'S' || d.dayName === 'D';
                                            return (<td key={d.dayNum} className={`p-1 text-center border-l border-slate-100 dark:border-slate-800 ${isWeekend ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}><div className={`w-3 h-3 mx-auto rounded-full transition-all duration-300 ${bgClass} ${opacityClass}`} title={`${emp.nombre}: ${displayStatus || '-'}`}>{displayStatus === 'Libre' && !focusMode && <div className="text-[8px] text-white flex justify-center items-center w-full h-full font-bold">L</div>}</div></td>);
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* --- VIEW: ANALYTICS --- */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Retention KPI (PLUS) */}
                  <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                     <h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider mb-2">Tasa de Retención</h3>
                     <div className="text-5xl font-black text-indigo-500 mb-2">{retentionRate}%</div>
                     <p className="text-xs text-slate-500">Empleados Activos vs Egresos Totales</p>
                  </div>

                  <div className="glass-panel p-6 rounded-2xl">
                     <h3 className="font-bold text-lg mb-6 flex gap-2 items-center text-slate-800 dark:text-white"><PieChart className="text-indigo-500"/> Distribución de Días Libres</h3>
                     <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={daysOffDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} cursor={{fill: 'rgba(99, 102, 241, 0.1)'}} />
                            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]}><Cell fill='#6366f1'/></Bar>
                          </BarChart>
                        </ResponsiveContainer>
                     </div>
                  </div>
              </div>
          </div>
        )}

        {/* --- VIEW: DIRECTORY --- */}
        {activeTab === 'directory' && (
          <div className="space-y-6 animate-fade-in">
             <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex gap-2 flex-1 w-full">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por Nombre, Cédula o Cargo..." className="glass-input w-full pl-9 bg-transparent"/>
                    </div>
                    {dataQualityScore < 100 && (
                        <div className="hidden md:flex items-center gap-2 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" title="Calidad de Base de Datos">
                            <Database size={14} className={dataQualityScore < 80 ? 'text-rose-500' : 'text-amber-500'}/>
                            <span className="text-xs font-bold text-slate-500">{dataQualityScore}% Calidad</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                   {/* Plus 2: Data Quality Filter */}
                   <button onClick={() => setShowIncompleteData(!showIncompleteData)} className={`px-3 py-2 rounded text-xs font-bold flex gap-2 items-center ${showIncompleteData ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`} title="Ver perfiles incompletos"><FileQuestion size={16}/> {showIncompleteData ? 'Incompletos' : 'Faltan Datos'}</button>
                   
                   <button onClick={() => setShowRiskOnly(!showRiskOnly)} className={`px-3 py-2 rounded text-xs font-bold flex gap-2 ${showRiskOnly ? 'bg-rose-500 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}><Activity size={16}/> Riesgo</button>
                   <button onClick={() => setShowOnlyDuplicates(!showOnlyDuplicates)} className={`px-3 py-2 rounded text-xs font-bold ${showOnlyDuplicates ? 'bg-rose-500 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>DUP</button>
                   
                   {/* Upload Section with Legend */}
                   <div className="flex gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg items-center relative">
                        <input type="file" ref={fileInputRef} onChange={processImportFile} className="hidden" accept=".txt,.csv"/>
                        <button onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors"><Upload size={16}/></button>
                        
                        {/* Interactive Legend Tooltip */}
                        <div className="group relative">
                            <button className="p-1.5 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors text-indigo-500"><HelpCircle size={16}/></button>
                            <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 text-white text-xs rounded-xl shadow-2xl p-4 z-50 hidden group-hover:block border border-slate-700">
                                <h4 className="font-bold text-indigo-400 mb-2 flex items-center gap-2"><FileSpreadsheet size={14}/> Formato Requerido</h4>
                                <ol className="list-decimal pl-4 space-y-1 text-slate-300 mb-3">
                                    <li>Nombre Completo</li>
                                    <li>Cédula</li>
                                    <li>Correo</li>
                                    <li>Fecha Ingreso</li>
                                    <li>Mesa (Opcional)</li>
                                    <li>Turno (AM/PM)</li>
                                    <li>Día Libre</li>
                                    <li>CS Asignado</li>
                                    <li>Cargo (Opcional)</li>
                                </ol>
                                <div className="p-2 bg-slate-800 rounded border border-slate-700 text-[10px] font-mono break-all text-slate-400">Juan,123,juan@mail.com,2024-01-01,,PM,DOMINGO,Maria,Agente</div>
                                <button onClick={handleDownloadTemplate} className="mt-3 w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded font-bold">Descargar Plantilla</button>
                            </div>
                        </div>
                   </div>

                   {/* CLEAR ALL BUTTON */}
                   <button onClick={handleClearAllEmployees} className="px-3 py-2 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-colors" title="Borrar toda la base de datos"><Trash2 size={16}/></button>

                   <button onClick={handleExportCSV} className="px-3 py-2 rounded bg-emerald-600/10 text-emerald-500 border border-emerald-500/20"><Download size={16}/></button>
                   <button onClick={() => setShowAddModal(true)} className="px-4 py-2 rounded bg-indigo-600 text-white font-bold flex gap-2"><UserPlus size={16}/> Registro</button>
                </div>
             </div>
             <div className="glass-panel rounded-2xl overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 font-bold"><tr><th className="px-6 py-4">Empleado</th><th className="px-6 py-4">Cargo</th><th className="px-6 py-4">CS Asignado</th><th className="px-6 py-4">Datos</th><th className="px-6 py-4">Libre</th><th className="px-6 py-4">Antigüedad</th><th className="px-6 py-4 text-center">Score</th><th className="px-6 py-4 text-right">Acción</th></tr></thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                         {filteredEmployees.map(emp => {
                            const isDup = duplicateMap[emp.cedula] > 1; const isRisk = emp.reliabilityScore < 90; const csKey = `${emp.turno}-${emp.csAsignado.toLowerCase().trim()}`; const isCsDup = csDuplicateMap[csKey] > 1;
                            const profileHealth = calculateProfileHealth(emp);
                            return (
                               <tr key={emp.id} className={`group hover:bg-slate-50 dark:hover:bg-slate-800/30 ${isDup ? 'bg-rose-500/10' : ''}`}>
                                  <td className="px-6 py-4 flex gap-3 items-center"><div className={`w-8 h-8 rounded-full flex justify-center items-center text-white font-bold ${isDup ? 'bg-rose-600 animate-pulse' : 'bg-slate-500'}`}>{isDup ? '!' : emp.nombre.charAt(0)}</div><div><div className="font-bold flex items-center gap-1">{emp.nombre} {emp.reliabilityScore === 100 && <Flame size={12} className="text-amber-500 fill-amber-500" />}</div><div className="text-xs text-slate-500">{emp.cedula}</div></div></td>
                                  <td className="px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">{emp.cargo || '-'}</td>
                                  <td className={`px-6 py-4 text-xs font-medium transition-colors duration-500 ${isCsDup ? 'bg-rose-500/20 text-rose-500 font-bold border-l-4 border-rose-500 animate-pulse' : 'text-slate-500 dark:text-slate-400'}`}>{emp.csAsignado || 'Sin Asignar'} {isCsDup && <span className="ml-1 text-[10px] bg-rose-500 text-white px-1 rounded">DUP</span>}</td>
                                  
                                  {/* Plus 1: Profile Health Bar */}
                                  <td className="px-6 py-4">
                                      <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden" title={`${profileHealth}% completo`}>
                                          <div className={`h-full ${profileHealth === 100 ? 'bg-emerald-500' : profileHealth > 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{width: `${profileHealth}%`}}></div>
                                      </div>
                                  </td>

                                  <td className="px-6 py-4 font-mono">{emp.libranza}</td>
                                  <td className="px-6 py-4 text-indigo-500 font-bold">{getSeniority(emp.fechaIngreso)}</td>
                                  <td className="px-6 py-4 text-center font-bold"><span className={isRisk ? 'text-rose-500' : 'text-emerald-500'}>{emp.reliabilityScore}</span></td>
                                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                                      {/* PLUS: Quick Contact */}
                                      {emp.email && <a href={`mailto:${emp.email}`} className="text-slate-400 hover:text-indigo-500" title="Contactar"><Mail size={16}/></a>}
                                      <button onClick={() => { setEditingEmployeeId(emp.id); setEmployeeTab('info'); }} className="text-indigo-500"><Pencil size={16}/></button><button onClick={() => setShowIncidentModal(emp.id)} className="text-amber-500"><AlertTriangle size={16}/></button><button onClick={() => setShowStatusModal(emp.id)} className="text-rose-500"><Settings size={16}/></button>
                                  </td>
                               </tr>
                            )
                         })}
                      </tbody>
                   </table>
             </div>
          </div>
        )}

        {/* --- VIEW: LOGS --- */}
        {activeTab === 'logs' && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
              <div className="glass-panel p-6 rounded-2xl h-min sticky top-24">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold flex gap-2"><ClipboardList size={18}/> {editingLogId ? 'Editar Nota' : 'Nueva Nota'}</h3><button onClick={generateLogSummary} className="text-xs bg-indigo-500/10 text-indigo-500 px-2 py-1 rounded hover:bg-indigo-500 hover:text-white flex gap-1 items-center"><Sparkles size={12}/> Autogenerar</button></div>
                <textarea value={logInput} onChange={e => setLogInput(e.target.value)} className="glass-input w-full h-48 p-3 rounded-xl mb-4 resize-none" placeholder="Escribir bitácora..."></textarea>
                <button onClick={handleAddLog} className={`w-full text-white font-bold py-3 rounded-xl ${editingLogId ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                    {editingLogId ? 'Actualizar Nota' : 'Guardar'}
                </button>
                {editingLogId && (
                    <button onClick={() => { setEditingLogId(null); setLogInput(''); }} className="w-full mt-2 text-slate-500 text-xs">Cancelar Edición</button>
                )}
              </div>
              <div className="md:col-span-2 space-y-4">
                  {shiftLogs.map(log => (
                      <div key={log.id} className="glass-panel p-5 rounded-xl border-l-4 border-indigo-500 relative group">
                          <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditLog(log)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"><Pencil size={14}/></button>
                              <button onClick={() => handleDeleteLog(log.id)} className="p-1 hover:bg-rose-500/20 rounded text-rose-500"><Trash2 size={14}/></button>
                          </div>
                          <div className="flex justify-between text-xs opacity-50 mb-1"><span>{log.author}</span><span>{log.timestamp}</span></div>
                          <p className="text-sm whitespace-pre-line">{log.text}</p>
                      </div>
                  ))}
              </div>
           </div>
        )}
      </main>

      {/* --- MODALS --- */}
      {showConfigModal && (<Modal title="Conectar Nube" onClose={() => setShowConfigModal(false)}><div className="space-y-4"><p className="text-sm text-slate-500">Para sincronizar datos, pega aquí la URL de tu Google Apps Script (la que termina en <code>/exec</code>).</p><input value={apiUrlInput} onChange={e => setApiUrlInput(e.target.value)} placeholder="https://script.google.com/..." className="glass-input w-full p-2 rounded"/><button onClick={() => {DataService.setApiUrl(apiUrlInput); setShowConfigModal(false);}} className="w-full bg-emerald-600 text-white py-2 rounded font-bold">Conectar</button><button onClick={() => setShowConfigModal(false)} className="w-full text-slate-500 text-xs mt-2">Usar modo local (offline)</button></div></Modal>)}
      {showAddModal && <Modal title="Registro" onClose={() => setShowAddModal(false)}><form onSubmit={handleAddEmployee} className="space-y-4"><input name="nombre" placeholder="Nombre Completo" required className="glass-input w-full p-2 rounded"/><input name="cargo" placeholder="Cargo (Puesto)" className="glass-input w-full p-2 rounded"/><input name="cedula" placeholder="Cédula" required className="glass-input w-full p-2 rounded"/><input name="email" placeholder="Correo Corporativo" className="glass-input w-full p-2 rounded"/><div className="grid grid-cols-2 gap-2"><select name="turno" className="glass-input w-full p-2 rounded bg-transparent"><option value="PM">PM</option><option value="AM">AM</option></select><select name="libranza" className="glass-input w-full p-2 rounded bg-transparent">{DAYS_OPTIONS.map(day => <option key={day} value={day}>{day}</option>)}</select></div><input name="csAsignado" placeholder="CS Asignado (Líder)" required className="glass-input w-full p-2 rounded"/><input name="fechaIngreso" type="date" required className="glass-input w-full p-2 rounded"/><button className="w-full bg-indigo-600 text-white font-bold py-2 rounded">Guardar</button></form></Modal>}
      {editingEmployeeId && (<Modal title="Ficha" onClose={() => setEditingEmployeeId(null)} maxWidth="max-w-2xl">{(() => { const emp = employees.find(e => e.id === editingEmployeeId); if(!emp) return null; return (<div className="flex flex-col h-[70vh]"><div className="flex gap-4 border-b border-slate-700 mb-4 pb-2"><button onClick={() => setEmployeeTab('info')} className={`text-sm font-bold ${employeeTab === 'info' ? 'text-indigo-500' : ''}`}>Datos</button><button onClick={() => setEmployeeTab('coaching')} className={`text-sm font-bold ${employeeTab === 'coaching' ? 'text-indigo-500' : ''}`}>Coaching</button></div><div className="flex-1 overflow-y-auto pr-2">{employeeTab === 'info' && <form onSubmit={handleUpdateEmployee} className="space-y-4"><div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold">Nombre</label><input name="nombre" defaultValue={emp.nombre} className="glass-input w-full p-2 rounded"/></div><div><label className="text-xs font-bold">Cédula</label><input name="cedula" defaultValue={emp.cedula} className="glass-input w-full p-2 rounded"/></div></div><div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold">Cargo</label><input name="cargo" defaultValue={emp.cargo} className="glass-input w-full p-2 rounded"/></div><div><label className="text-xs font-bold">CS Asignado (Líder)</label><input name="csAsignado" defaultValue={emp.csAsignado} className="glass-input w-full p-2 rounded"/></div></div><div><label className="text-xs font-bold">Correo</label><input name="email" defaultValue={emp.email} className="glass-input w-full p-2 rounded"/></div><div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold">Turno</label><select name="turno" defaultValue={emp.turno} className="glass-input w-full p-2 bg-transparent rounded"><option value="PM">PM</option><option value="AM">AM</option></select></div><div><label className="text-xs font-bold">Libre</label><select name="libranza" defaultValue={emp.libranza} className="glass-input w-full p-2 bg-transparent rounded">{DAYS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}</select></div></div><div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold text-emerald-500">Fecha Ingreso</label><input name="fechaIngreso" type="date" defaultValue={emp.fechaIngreso} className="glass-input w-full p-2 rounded"/></div><div><label className="text-xs font-bold text-rose-500">Fecha Egreso</label><input name="fechaFin" type="date" defaultValue={emp.fechaFin} className="glass-input w-full p-2 rounded"/></div></div><div className="flex justify-between pt-4"><button type="button" onClick={handleDeleteEmployee} className="text-rose-500 text-xs font-bold flex gap-1"><Trash2 size={14}/> Eliminar</button><button className="bg-emerald-600 px-4 py-2 rounded text-white font-bold">Guardar</button></div></form>}{employeeTab === 'coaching' && <div className="space-y-4"><form onSubmit={handleAddCoaching} className="bg-slate-800/30 p-3 rounded space-y-2"><input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="glass-input w-full p-2 rounded"/><textarea name="notes" placeholder="Nota..." required className="glass-input w-full p-2 rounded h-20"></textarea><button className="bg-indigo-600 text-white w-full py-1 rounded text-xs font-bold">Agregar</button></form><div className="space-y-2">{(emp.coachingHistory||[]).map(c=><div key={c.id} className="p-3 bg-slate-100 dark:bg-slate-800 border-l-4 border-indigo-500 rounded"><div className="text-xs opacity-50 mb-1">{c.date}</div><p className="text-sm">{c.notes}</p></div>)}</div></div>}</div></div>) })()}</Modal>)}
      {showIncidentModal && <Modal title="Incidencia" onClose={() => setShowIncidentModal(null)}><form onSubmit={handleAddIncident} className="space-y-4"><select name="type" className="glass-input w-full p-2 rounded bg-transparent"><option value="Tardanza">Tardanza</option><option value="Ausencia">Ausencia</option><option value="Conducta">Conducta</option></select><input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="glass-input w-full p-2 rounded"/><button className="w-full bg-indigo-600 text-white font-bold py-2 rounded">Registrar</button></form></Modal>}
      {showStatusModal && (<Modal title="Gestión de Estatus Laboral" onClose={() => setShowStatusModal(null)}><form onSubmit={handleStatusChange} className="space-y-4"><div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm text-slate-500">Seleccione la nueva condición del colaborador:</div><div className="space-y-2"><label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><input type="radio" name="status" value="Egreso" className="accent-rose-500" required /><div><span className="block font-bold text-rose-500">Dar de Baja (Egreso)</span><span className="text-xs text-slate-400">Retiro definitivo. Moverá al histórico.</span></div></label><label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><input type="radio" name="status" value="Licencia" className="accent-blue-500" required /><div><span className="block font-bold text-blue-500">Suspender / Licencia / Reposo</span><span className="text-xs text-slate-400">Pausar actividad (Maternidad, Reposo Médico largo).</span></div></label><label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><input type="radio" name="status" value="Activo" className="accent-emerald-500" required /><div><span className="block font-bold text-emerald-500">Reactivar</span><span className="text-xs text-slate-400">Volver a nómina activa.</span></div></label></div><div><label className="text-xs font-bold mb-1 block">Fecha de Efecto</label><input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="glass-input w-full p-2 rounded"/></div><button className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl mt-2 hover:bg-indigo-500 transition-colors">Aplicar Cambio</button></form></Modal>)}

      {/* --- PLUS: IMPORT PREVIEW MODAL --- */}
      {showImportModal && (
          <Modal title="Validación de Importación" onClose={() => setShowImportModal(false)} maxWidth="max-w-4xl">
              <div className="space-y-4">
                  <div className="flex gap-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      <div className="flex items-center gap-2 text-emerald-500 font-bold"><Check size={20}/> {importPreviewData.length} Registros Válidos</div>
                      <div className="flex items-center gap-2 text-slate-500 text-sm border-l pl-4 border-slate-600">Por favor revisa que los datos sean correctos antes de confirmar.</div>
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-700">
                      <table className="w-full text-xs text-left">
                          <thead className="bg-slate-200 dark:bg-slate-800 text-slate-500 font-bold sticky top-0">
                              <tr><th className="p-2">Nombre</th><th className="p-2">Cédula</th><th className="p-2">Cargo</th><th className="p-2">CS</th><th className="p-2">Turno</th><th className="p-2">Libre</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                              {importPreviewData.map((e, i) => (
                                  <tr key={i} className="hover:bg-slate-800/50">
                                      <td className="p-2">{e.nombre}</td><td className="p-2">{e.cedula}</td><td className="p-2">{e.cargo}</td><td className="p-2">{e.csAsignado}</td><td className="p-2">{e.turno}</td><td className="p-2">{e.libranza}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                      <button onClick={() => setShowImportModal(false)} className="px-4 py-2 rounded text-slate-400 hover:bg-slate-800">Cancelar</button>
                      <button onClick={confirmImport} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded shadow-lg hover:bg-emerald-500">Confirmar Importación</button>
                  </div>
              </div>
          </Modal>
      )}

      {/* Chat Bot */}
      <div className="fixed bottom-6 right-6 z-50">
        {!showChat && <button onClick={() => setShowChat(true)} className="bg-indigo-600 text-white p-4 rounded-full shadow-xl"><MessageSquare size={24}/></button>}
        {showChat && <div className="glass-panel w-80 h-96 rounded-2xl shadow-2xl flex flex-col mb-4 mr-4"><div className="bg-indigo-600 p-3 text-white flex justify-between font-bold text-sm"><span>IA HR</span><button onClick={()=>setShowChat(false)}><X size={16}/></button></div><div className="flex-1 overflow-y-auto p-3 space-y-2">{chatHistory.map((m,i)=><div key={i} className={`p-2 rounded text-xs max-w-[85%] ${m.role==='user'?'bg-indigo-100 ml-auto text-indigo-900':'bg-slate-800'}`}>{m.text}</div>)}{isChatLoading&&<div className="text-xs animate-pulse text-center">...</div>}</div><form onSubmit={handleChat} className="p-2 border-t border-slate-700 flex gap-2"><input value={chatInput} onChange={e=>setChatInput(e.target.value)} className="flex-1 bg-transparent text-xs"/><button><MessageSquare size={16} className="text-indigo-500"/></button></form></div>}
      </div>
    </div>
  );
}
