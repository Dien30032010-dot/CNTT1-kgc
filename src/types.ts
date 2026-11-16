export type Role = "student" | "teacher" | "admin" | "officer";

export type ThemeMode = "default" | "dark" | "sakura" | "green";

export type PageId =
  | "home"
  | "announcements"
  | "members"
  | "myGrades"
  | "myViolations"
  | "students"
  | "grades"
  | "evaluations"
  | "violations"
  | "violationSummary"
  | "fund"
  | "teachers"
  | "officers"
  | "requests"
  | "settings";

export interface Student {
  name: string;
  id: string;
}

export interface Teacher {
  name: string;
  subject: string;
}

export interface Officer {
  name: string;
  position: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorRole: Role;
  authorDetail?: string;
  at: string;
}

export interface FundRecord {
  id: string;
  kind: "income" | "expense";
  title: string;
  amount: number;
  date: string;
  note: string;
  byName: string;
  byPosition?: string;
  at: string;
}

export interface GradeRecord {
  id: string;
  sid: string;
  subject: string;
  value: number;
  term: string;
  note: string;
  by: string;
  byName?: string;
  at: string;
}

export interface EvaluationRecord {
  id: string;
  sid: string;
  level: string;
  note: string;
  by: string;
  byName?: string;
  at: string;
}

export interface ViolationRecord {
  id: string;
  sid: string;
  type: string;
  detail: string;
  date?: string;
  by: string;
  byName?: string;
  at: string;
}

export interface EditRequest {
  id: string;
  kind: "grade" | "evaluation" | "violation";
  recordId: string;
  reason: string;
  from: string;
  fromName?: string;
  at: string;
  status: "Chờ xử lý" | "Đã xử lý";
}

export interface ClassDatabase {
  teacherPass: string;
  adminPass: string;
  officerPass: string;
  theme: ThemeMode;
  className: string;
  school: string;
  students: Student[];
  teachers: Teacher[];
  officers: Officer[];
  officersSeeded?: boolean;
  officersSeedVersion?: number;
  announcements: Announcement[];
  fundRecords: FundRecord[];
  grades: GradeRecord[];
  evaluations: EvaluationRecord[];
  violations: ViolationRecord[];
  requests: EditRequest[];
  deletedIds?: string[];
}

export interface SessionState {
  role: Role;
  currentStudent: string;
  currentTeacher: string;
  currentTeacherSubject: string;
  currentOfficer: string;
  currentOfficerPosition: string;
}
