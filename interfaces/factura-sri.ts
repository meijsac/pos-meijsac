export interface ItemFactura {
  codigoPrincipal: string;
  codigoAuxiliar?: 'H492001' | 'H492002' | string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotalSinImpuesto: number;
  tarifaIva: '0';
}

export interface FacturaTransporteInput {
  importeTotal: number;
  placaVehiculo?: string;
  detalles: ItemFactura[];
  informacionAdicional?: {
    rucSocioTransicion?: string;
    razonSocialSocioTransicion?: string;
  };
}
