from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class AuditCreateInput(BaseModel):
    cr_tienda: str


class ScanInput(BaseModel):
    barcode: str


class AuditCancelInput(BaseModel):
    reason: str


class NotesInput(BaseModel):
    notes: str


class UnknownSurplusInput(BaseModel):
    codigo_barras: str
    descripcion: str
    marca: str
    modelo: str
    no_activo: Optional[str] = ""
    serie: Optional[str] = ""


class FinalizeWithPhotosInput(BaseModel):
    photo_ab_base64: Optional[str] = None
    photo_transfer_base64: Optional[str] = None


class AuditOut(BaseModel):
    id: str
    cr_tienda: str
    tienda: str
    plaza: str
    cr_plaza: str
    auditor_id: str
    auditor_name: str
    started_at: datetime
    finished_at: Optional[datetime]
    status: str
    located_count: int
    surplus_count: int
    not_found_count: int
    not_found_value: float
    total_equipment: int
    notes: str

    class Config:
        from_attributes = True


class ScanOut(BaseModel):
    id: str
    audit_id: str
    codigo_barras: str
    equipment_id: Optional[str]
    classification: str
    equipment_data: Optional[Any]
    origin_store: Optional[Any]
    scanned_at: datetime
    scanned_by: str
    registered_manually: bool

    class Config:
        from_attributes = True


class MovementOut(BaseModel):
    id: str
    audit_id: str
    equipment_id: Optional[str]
    type: str
    from_cr_tienda: Optional[str]
    to_cr_tienda: Optional[str]
    from_tienda: Optional[str]
    to_tienda: Optional[str]
    plaza: str
    status: str
    auto_generated: bool
    equipment_data: Optional[Any]
    created_at: datetime
    created_by: str
    created_by_id: str

    class Config:
        from_attributes = True


class MovementCreateInput(BaseModel):
    audit_id: str
    equipment_id: Optional[str] = None
    type: str
    from_cr_tienda: Optional[str] = None
    to_cr_tienda: Optional[str] = None
    extra_data: Optional[dict] = None
