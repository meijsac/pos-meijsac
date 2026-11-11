import { z } from "zod"

const correo = z.string().trim().email().optional().or(z.literal(""))
const identificacion = z.string().trim().regex(/^\d*$/).optional().or(z.literal(""))

export const esquemaFactura = z.object({
  placaVehiculo: z.string().trim().regex(/^[A-Z0-9-]{0,8}$/).optional().or(z.literal("")),
  cliente: z.object({
    email: correo,
    identificacion: identificacion,
    tipoDoc: z.string().optional(),
    tipoId: z.string().optional(),
  }).optional(),
  items: z.array(z.object({
    cant: z.number().nonnegative().optional(),
    cantidad: z.number().nonnegative().optional(),
    pUnit: z.number().nonnegative().optional(),
    precioUnitario: z.number().nonnegative().optional(),
    descPorc: z.number().nonnegative().optional(),
    descuento: z.number().nonnegative().optional(),
  }).passthrough()).optional(),
}).passthrough()

export const esquemaCertificado = z.object({
  clave: z.string().min(1).max(200),
  nombre: z.string().min(1).max(180),
})

export function errorZod(error: z.ZodError) {
  return error.issues[0]?.message || "Datos inválidos"
}
