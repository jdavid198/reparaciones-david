import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, orderBy, doc, updateDoc, where } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';

export interface RepairEntry {
  id?: string;
  fechaIngreso: string;
  nombre: string;
  telefono: string;
  cantidad: number;
  descripcion : string;
  valorTrabajo: number;
  abono: number;
  saldo: number;
  codigoReclamacion: string;
  estado: 'pendiente' | 'entregada' | 'cancelada';
  fechaCreacion?: Date;
  fechaFinalizacion?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class RepairService {
  private firestore = inject(Firestore);

  async addEntry(entry: Omit<RepairEntry, 'id' | 'estado' | 'fechaCreacion'>) {
    const reparacionesRef = collection(this.firestore, 'reparaciones');
    const nuevaReparacion = {
      ...entry,
      cantidad: entry.cantidad ?? 1,
      estado: 'pendiente' as const,
      fechaCreacion: new Date()
    };
    return await addDoc(reparacionesRef, nuevaReparacion);
  }

  async actualizarEstado(id: string, nuevoEstado: 'pendiente' | 'entregada' | 'cancelada') {
    try {
      const docRef = doc(this.firestore, 'reparaciones', id);
      const updateData: any = { estado: nuevoEstado };
      
      // Si se marca como entregada o cancelada, agregar fecha de finalización
      if (nuevoEstado === 'entregada' || nuevoEstado === 'cancelada') {
        updateData.fechaFinalizacion = new Date();
      } else if (nuevoEstado === 'pendiente') {
        // Si vuelve a pendiente, quitar la fecha de finalización
        updateData.fechaFinalizacion = null;
      }
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      throw error;
    }
  }

  getEntries(filtro?: string): Observable<RepairEntry[]> {
    const filtroSeguro = filtro || '';
    console.log('getEntries llamado con filtro:', filtroSeguro);
    return from(this.buscarReparaciones(filtroSeguro));
  }

  async buscarReparaciones(filtro: string = ''): Promise<RepairEntry[]> {
    try {
      // Validación defensiva del filtro
      const filtroSeguro = filtro || '';
      console.log('Filtro recibido:', filtroSeguro);
      
      const reparacionesRef = collection(this.firestore, 'reparaciones');
      
      if (!filtroSeguro.trim()) {
        // Si no hay filtro, devolver todas ordenadas por fecha de ingreso
        const q = query(reparacionesRef, orderBy('fechaIngreso', 'desc'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as RepairEntry));
      }

      // Obtener todos los documentos y filtrar en el cliente
      // Esto es más simple y no requiere índices complejos en Firebase
      const q = query(reparacionesRef, orderBy('fechaIngreso', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const todosLosDatos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RepairEntry));

      // Filtrar en el cliente por código de reclamación o teléfono
      const filtroLower = filtroSeguro.toLowerCase();
      return todosLosDatos.filter(rep => {
        try {
          // Validaciones defensivas para los campos de los datos
          const codigo = rep.codigoReclamacion || '';
          const telefono = rep.telefono || '';
          
          return codigo.toLowerCase().includes(filtroLower) ||
                 telefono.includes(filtroSeguro);
        } catch (fieldError) {
          console.warn('Error al filtrar registro:', rep.id, fieldError);
          return false; // Excluir registros con datos corruptos
        }
      });

    } catch (error) {
      console.error('Error al buscar reparaciones:', error);
      throw error;
    }
  }

  async actualizarReparacion(id: string, cambios: Partial<RepairEntry>) {
    try {
      const docRef = doc(this.firestore, 'reparaciones', id);
      await updateDoc(docRef, cambios);
    } catch (error) {
      console.error('Error al actualizar reparación:', error);
      throw error;
    }
  }

}
