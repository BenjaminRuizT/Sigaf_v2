from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EquipmentOut(BaseModel):
    id: str
    cr_plaza: str
    plaza: str
    cr_tienda: str
    tienda: str
    codigo_barras: str
    no_activo: str
    mes_adquisicion: int
    año_adquisicion: int
    factura: str
    costo: float
    depreciacion: float
    vida_util: int
    remanente: int
    descripcion: str
    marca: str
    modelo: str
    serie: str
    meses_transcurridos: int
    vida_util_restante: int
    valor_real: float
    depreciado: bool
    alta_manual: bool

    class Config:
        from_attributes = True


class EquipmentUpdateInput(BaseModel):
    codigo_barras: Optional[str] = None
    no_activo: Optional[str] = None
    descripcion: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    serie: Optional[str] = None
    costo: Optional[float] = None
    depreciacion: Optional[float] = None


class PaginatedEquipment(BaseModel):
    items: list[EquipmentOut]
    total: int
    page: int
    pages: int
