export interface UserAnswers {
  name: string;
  phone: string;
  target_position: string;
  experience_level: string;
  last_job: string;
  education: string;
  skills: string[];
  city: string;
  salary: string;
  about: string;
  email: string;
  languages: string;
  certificates: string;
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
}
