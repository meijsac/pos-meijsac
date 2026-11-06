import { Share } from '@capacitor/share';

export class PrinterService {
  static getCols(ancho: number) {
    return ancho <= 58 ? 32 : 48;
  }
  static centrar(text: string, cols: number) {
    const espacios = Math.max(0, Math.floor((cols - text.length) / 2));
    return ' '.repeat(espacios) + text;
  }
  static linea(cols: number) {
    return '-'.repeat(cols);
  }
  
  // Por ahora solo WhatsApp, el Bluetooth lo conectamos luego que compile
  static async compartirWhatsApp(venta: any) {
    const mensaje = `*MEIJSAC - Ticket #${venta.id}*\nCliente: ${venta.cliente}\nTotal: $${venta.total}\n\nGracias por tu compra!`;
    await Share.share({
      title: 'Ticket MEIJSAC',
      text: mensaje,
      dialogTitle: 'Enviar por WhatsApp',
    });
  }
}