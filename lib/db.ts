import Dexie, { Table } from 'dexie';

export interface ProductoLocal {
  id?: number;
  codigo: string;
  nombre: string;
  precio: number;
  stock: number;
}

export interface VentaLocal {
  id?: number;
  fecha: string;
  total: number;
  items: any[];
  tipo: 'TICKET' | 'FACTURA_XML';
  estadoSRI: 'PENDIENTE' | 'AUTORIZADO' | 'NO_APLICA';
  xml?: string;
}

export class MeijsacDB extends Dexie {
  productos!: Table<ProductoLocal>;
  ventas!: Table<VentaLocal>;

  constructor() {
    super('MeijsacPOS');
    this.version(1).stores({
      productos: '++id, codigo, nombre',
      ventas: '++id, fecha, estadoSRI, tipo'
    });
  }
}

export const db = new MeijsacDB();