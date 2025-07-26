import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RepairService, RepairEntry } from './services/repair';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('david-peleteria');
  form: FormGroup;
  reparaciones: RepairEntry[] = [];
  filtroTexto: string = '';
  filtroAplicado: string = '';
  filtrandoEnFirebase: boolean = false;

  constructor(private fb: FormBuilder, private repairService: RepairService) {
    this.form = this.fb.group({
      fechaIngreso: ['', Validators.required],
      nombre: ['', Validators.required],
      telefono: ['', Validators.required],
      valorTrabajo: [0, Validators.required],
      abono: [0, Validators.required],
      saldo: [0, Validators.required],
      codigoReclamacion: ['', Validators.required]
    });

    this.cargarReparaciones('');
  }

  registrar() {
    if (this.form.valid) {
      this.repairService.addEntry(this.form.value).then(() => {
          this.form.reset();
          this.cargarReparaciones(this.filtroAplicado || '');
      });
    }
  }

  get reparacionesFiltradas(): RepairEntry[] {
    // Ahora el filtro se hace en Firebase, así que siempre devolvemos todas las reparaciones cargadas
    return this.reparaciones;
  }

  async cambiarEstado(id: string, nuevoEstado: 'pendiente' | 'entregada' | 'cancelada') {
    try {
      await this.repairService.actualizarEstado(id, nuevoEstado);
      // Recargar datos después de actualizar
      this.cargarReparaciones(this.filtroAplicado || '');
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      alert('Error al cambiar el estado de la reparación');
    }
  }

  get hayFiltroActivo(): boolean {
    return (this.filtroAplicado || '').trim().length > 0;
  }

  cargarReparaciones(filtro: string = '') {
    // Validación defensiva del filtro
    const filtroSeguro = filtro || '';
    console.log('cargarReparaciones llamado con filtro:', filtroSeguro);
    
    this.filtrandoEnFirebase = true;
    this.repairService.getEntries(filtroSeguro).subscribe({
      next: (data) => {
        this.reparaciones = data;
        this.filtroAplicado = filtroSeguro;
        this.filtrandoEnFirebase = false;
      },
      error: (error) => {
        console.error('Error al cargar reparaciones:', error);
        this.filtrandoEnFirebase = false;
      }
    });
  }

  buscar() {
    if (this.filtrandoEnFirebase) return; // Evitar búsquedas múltiples
    const filtroSeguro = (this.filtroTexto || '').trim();
    console.log('Buscando con filtro:', filtroSeguro);
    this.cargarReparaciones(filtroSeguro);
  }

  limpiarFiltro() {
    this.filtroTexto = '';
    this.filtroAplicado = '';
    this.cargarReparaciones('');
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'entregada':
        return 'estado-entregada';
      case 'cancelada':
        return 'estado-cancelada';
      default:
        return 'estado-pendiente';
    }
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return '-';
    
    try {
      // Si es un Timestamp de Firebase, convertir a Date
      let fechaDate: Date;
      if (fecha.toDate && typeof fecha.toDate === 'function') {
        fechaDate = fecha.toDate();
      } else if (fecha instanceof Date) {
        fechaDate = fecha;
      } else {
        // Si es string o number, convertir a Date
        fechaDate = new Date(fecha);
      }
      
      return fechaDate.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return '-';
    }
  }

  exportarExcel() {
    // Formatear datos para Excel con fechas legibles
    const datosParaExportar = this.reparacionesFiltradas.map(rep => ({
      'Fecha Ingreso': rep.fechaIngreso,
      'Cliente': rep.nombre,
      'Teléfono': rep.telefono,
      'Valor del Trabajo': rep.valorTrabajo,
      'Abono': rep.abono,
      'Saldo': rep.saldo,
      'Código de Reclamación': rep.codigoReclamacion,
      'Estado': rep.estado.charAt(0).toUpperCase() + rep.estado.slice(1),
      'Fecha de Finalización': rep.fechaFinalizacion ? this.formatearFecha(rep.fechaFinalizacion) : 'Pendiente'
    }));
    
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(datosParaExportar);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    
    const nombreHoja = this.filtroTexto.trim() ? 'Reparaciones_Filtradas' : 'Reparaciones';
    const nombreArchivo = this.filtroTexto.trim() 
      ? `reparaciones_filtradas_${this.filtroTexto.trim()}.xlsx`
      : 'reparaciones.xlsx';
    
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
    XLSX.writeFile(wb, nombreArchivo);
  }
}
