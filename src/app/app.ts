import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RepairService, RepairEntry } from './services/repair';;
import * as XLSX from 'xlsx';
import { ToastService } from './services/toast.service';
import { ToastComponent } from "./toast.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ToastComponent],
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

  hoy: string = this.getHoy();

  constructor(private fb: FormBuilder, private repairService: RepairService, private toastService: ToastService) {
    this.form = this.fb.group({
      fechaIngreso: [this.hoy, Validators.required],
      nombre: ['', Validators.required],
      telefono: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(10)]],
      cantidad: [1, [Validators.required, Validators.min(1), Validators.max(12)]],
      descripcion: ['', [Validators.required, Validators.maxLength(150)]],
      valorTrabajo: [null, [Validators.required, Validators.min(1000)]],
      abono: [null, [Validators.required, Validators.min(1000)]],
      saldo: [0, Validators.required],
      codigoReclamacion: ['', Validators.required]
    });

    this.cargarReparaciones('');
  }

  private readonly campoLabels: Record<string, string> = {
    fechaIngreso: 'Fecha de Ingreso',
    nombre: 'Nombre del Cliente',
    telefono: 'Teléfono',
    cantidad: 'Cantidad de artículos',
    descripcion: 'Descripción',
    valorTrabajo: 'Valor del Trabajo',
    abono: 'Abono',
    codigoReclamacion: 'Código de Reclamación'
  };

  private mostrarErroresFormulario(): boolean {
    const camposInvalidos: string[] = [];
    let tieneErrores = false

    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      if (!control || control.valid) return;

      if (key === 'telefono') {
        if (control.hasError('minlength')) {
          this.toastService.error('Teléfono', ['El teléfono debe tener al menos 6 dígitos.']);
          tieneErrores = true;
        }
        if (control.hasError('maxlength')) {
          this.toastService.error('Teléfono', ['El teléfono no puede tener más de 10 dígitos.']);
          tieneErrores = true;
        }
      }

      if (control.hasError('required') && this.campoLabels[key]) {
        camposInvalidos.push(this.campoLabels[key]);
      }
    });

    if (camposInvalidos.length > 0) {
      this.toastService.error(
        'Faltan campos obligatorios',
        camposInvalidos.map(campo => `${campo}`)
      );
       tieneErrores = true;
    }

    return tieneErrores;
  }

  registrar() {
    const raw = this.form.getRawValue();
    const valorTrabajoNum = this.obtenerNumero(raw.valorTrabajo);
    const abonoNum = this.obtenerNumero(raw.abono);
    const saldoNum = valorTrabajoNum - abonoNum;
    const cantidad = Math.max(1, Number(raw.cantidad) || 1);

    if (this.mostrarErroresFormulario()) return;
    if (cantidad < 1) {
      this.toastService.info('Cantidad', ['La cantidad de artículos no puede ser negativa ni cero.']);
      return;
    }
    if (cantidad > 12) {
      this.toastService.error('Cantidad', ['La cantidad de artículos no puede ser mayor a 12']);
      return;
    }
    if (saldoNum < 0) {
      this.toastService.error('Saldo', ['El saldo no puede ser menor a 0.']);
      return;
    }
    if (valorTrabajoNum < 0 || valorTrabajoNum == 0) {
      this.toastService.error('Valor trabajo', ['El valor trabajo no puede ser 0 o menor.']);
      return;
    }
    if (abonoNum < 0 || abonoNum == 0) {
      this.toastService.error('Abono', ['El abono no puede ser 0 o menor.']);
      return;
    }

    const payload: Omit<RepairEntry, 'id' | 'estado' | 'fechaCreacion'> = {
      fechaIngreso: raw.fechaIngreso,
      nombre: raw.nombre,
      telefono: raw.telefono,
      cantidad,
      descripcion: raw.descripcion || '',
      valorTrabajo: valorTrabajoNum,
      abono: abonoNum,
      saldo: saldoNum,
      codigoReclamacion: raw.codigoReclamacion
    };

    this.repairService.addEntry(payload)
      .then(() => {
        this.toastService.success('Registro exitoso', ['La reparación fue guardada correctamente']);
        this.form.reset({
          fechaIngreso: this.getHoy(),
          cantidad: 1,
          descripcion: '',
          valorTrabajo: 0,
          abono: 0,
          saldo: 0,
          codigoReclamacion: '',
          nombre: '',
          telefono: ''
        });
        this.cargarReparaciones(this.filtroAplicado || '');
      })
      .catch(() => {
        this.toastService.error('Ocurrió un error', ['Ocurrió un error al registrar']);
      });
  }

  private getHoy(): string {
    const fecha = new Date();
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
      'Cantidad': rep.cantidad,
      'Descripción': rep.descripcion,
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

  formatearMoneda(campo: 'valorTrabajo' | 'abono') {
    let valor = this.form.get(campo)?.value || '';
    const soloNumeros = valor.toString().replace(/\D/g, '');
    const numero = soloNumeros ? parseInt(soloNumeros, 10) : 0;

    const valorFormateado = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(numero);

    this.form.get(campo)?.setValue(valorFormateado, { emitEvent: false });

    const valorTrabajo = this.obtenerNumero(this.form.get('valorTrabajo')?.value);
    const abono = this.obtenerNumero(this.form.get('abono')?.value);
    const saldo = valorTrabajo - abono;

    this.form.get('saldo')?.setValue(
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(saldo),
      { emitEvent: false }
    );
  }

  obtenerNumero(valor: string): number {
    if (!valor) return 0;
    return parseInt(valor.toString().replace(/\D/g, ''), 10) || 0;
  }

  validarInputTelefono(event: any) {
    let valor = event.target.value;
    const original = valor;

    // Quitar cualquier cosa que no sea número
    valor = valor.replace(/\D/g, '');
    if (valor !== original) {
      this.toastService.error('Teléfono', ['Solo se permiten númerosss']);
    }

    // Limitar a 10 dígitos
    if (valor.length > 10) {
      valor = valor.substring(0, 10);
      this.toastService.error('Teléfono', ['El teléfono solo puede tener 10 dígitos']);
    }

    // Setear el valor limpio al input y al form
    event.target.value = valor;
    this.form.get('telefono')?.setValue(valor, { emitEvent: false });
  }

  //MODAL DE EDITAR
  modalEditarVisible = false;
  formEditar!: FormGroup;
  repSeleccionada: any;

  editarReparacion(rep: any) {
    this.repSeleccionada = rep;
    this.formEditar = this.fb.group({
      nombre: [{ value: rep.nombre, disabled: true }],
      telefono: [{ value: rep.telefono, disabled: true }],
      fechaIngreso: [{ value: rep.fechaIngreso, disabled: true }],
      valorTrabajo: [{ value: rep.valorTrabajo, disabled: true }],
      saldo: [{ value: rep.saldo, disabled: true }],
      descripcion: [rep.descripcion, [Validators.required, Validators.maxLength(150)]],
      abono: [rep.abono, [Validators.required, Validators.min(0)]],
      cantidad: [rep.cantidad, [Validators.required, Validators.min(1)]],
    });

    this.formEditar.get('abono')?.valueChanges.subscribe((abono) => {
      const total = rep.valorTrabajo;
      const saldo = total - (abono || 0);
      this.formEditar.get('saldo')?.setValue(saldo >= 0 ? saldo : 0, { emitEvent: false });
    });

    this.modalEditarVisible = true;
  }


  cerrarModal() {
    this.modalEditarVisible = false;
  }

async guardarEdicion() {
  if (this.formEditar.invalid) return;

  const valoresEditados = this.formEditar.getRawValue();

  if (valoresEditados.abono > this.repSeleccionada.valorTrabajo) {
    this.toastService.error('Abono inválido', [
      'El abono no puede ser mayor al valor del trabajo',
    ]);
    return;
  }

  const nuevoSaldo = this.repSeleccionada.valorTrabajo - valoresEditados.abono;

  try {
    await this.repairService.actualizarReparacion(this.repSeleccionada.id, {
      descripcion: valoresEditados.descripcion,
      abono: valoresEditados.abono,
      cantidad: valoresEditados.cantidad,
      saldo: nuevoSaldo >= 0 ? nuevoSaldo : 0
    });

    this.toastService.success('Actualización exitosa', ['La reparación fue actualizada correctamente']);
    this.cargarReparaciones(this.filtroAplicado || '');
  } catch (err) {
    console.error('Error al actualizar:', err);
    this.toastService.error('Error al actualizar', ['No fue posible actualizar la reparación']);
  }

  this.cerrarModal();
}


}
