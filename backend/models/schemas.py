from typing import Any

from pydantic import BaseModel, Field


class SetTemplateRequest(BaseModel):
    template_id: str


class WorkEntry(BaseModel):
    company: str = ""
    position: str = ""
    period: str = ""
    duties: str = ""


class GenerateResumeRequest(BaseModel):
    target_position: str
    experience_level: str = "нет опыта"
    last_job: str = "опыта работы нет"
    work_history: list[WorkEntry] = Field(default_factory=list)
    education: str = "среднее"
    education_place: str = ""
    skills: list[str] = Field(default_factory=list)
    city: str = ""
    salary: str = ""
    about: str = ""
    name: str = ""
    phone: str = ""
    email: str = ""
    languages: str = ""
    certificates: str = ""
    gender: str = ""
    achievements: str = ""
    template_id: str = "classic"


class SuggestSkillsRequest(BaseModel):
    position: str = Field(min_length=1, max_length=150)


class SuggestSkillsResponse(BaseModel):
    skills: list[str]
    groups: dict[str, list[str]] = Field(default_factory=dict)


class ResumeGenerationResponse(BaseModel):
    resume_id: str
    resume: dict[str, Any]
    paid: bool


class TelegramAuthRequest(BaseModel):
    init_data: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_founder: bool = False
    unlimited: bool = False
