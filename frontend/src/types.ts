export interface WorkEntry {
  company: string;
  position: string;
  period: string;
  duties: string;
}

export interface UserAnswers {
  name: string;
  patronymic: string;
  gender: "Мужской" | "Женский" | "";
  phone: string;
  target_position: string;
  experience_level: string;
  last_job: string;
  work_history: WorkEntry[];
  education: string;
  education_place: string;
  skills: string[];
  city: string;
  salary: string;
  about: string;
  email: string;
  languages: string;
  certificates: string;
  achievements?: string;
  work_schedule?: string[];
  relocation?: string;
  profession_extra?: Record<string, string | string[]>;
  photo_jpeg_base64?: string;
}

export interface ResumeData {
  full_name: string;
  target_position: string;
  city: string;
  phone: string;
  email: string;
  summary: string;
  experience: Array<{
    company: string;
    position: string;
    period: string;
    description: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    year: string;
  }>;
  skills: string[];
  languages: string[];
  salary: string;
  certificates?: string[];
  work_schedule?: string[];
  relocation?: string;
  profession_extra?: Record<string, string | string[]>;
  key_achievements?: string[];
  documents_and_permits?: string[];
  photo_jpeg_base64?: string;
}
