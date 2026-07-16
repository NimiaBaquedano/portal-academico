let usuarioActual = null;
let misSeccionesCache = [];

async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.href = 'index.html'; return; }

  const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
  if (!perfil || perfil.rol !== 'profesor') { window.location.href = 'index.html'; return; }

  usuarioActual = perfil;
  document.getElementById('nombre-usuario').textContent = perfil.nombre;
  document.getElementById('titulo-bienvenida').textContent = `¡Bienvenido/a, ${perfil.nombre.split(' ')[0]}! 👋`;
  cargarSecciones();
}

function mostrarSeccion(nombre) {
  ['mis-secciones','tareas','materiales','calificaciones','estudiantes'].forEach(s => {
    document.getElementById('seccion-' + s).style.display = 'none';
  });
  document.getElementById('seccion-' + nombre).style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('activo'));
  event.target.classList.add('activo');

  if (nombre === 'tareas') { cargarSelectSecciones('tarea-seccion'); cargarTareasProfesor(); }
  if (nombre === 'materiales') { cargarSelectSecciones('mat-seccion'); cargarMateriales(); }
  if (nombre === 'calificaciones') cargarSelectTareasCalif();
  if (nombre === 'estudiantes') cargarSelectSecciones('select-seccion-est');
}

async function cargarSecciones() {
  const { data } = await supabase
    .from('secciones')
    .select('*')
    .eq('profesor_id', usuarioActual.id)
    .order('created_at', { ascending: false });

  misSeccionesCache = data || [];
  document.getElementById('stat-secciones').textContent = misSeccionesCache.length;

  const contenedor = document.getElementById('lista-secciones');

  if (!data || data.length === 0) {
    contenedor.innerHTML = '<div class="tarjeta"><p style="color:var(--plata);">Aún no has creado ninguna sección.</p></div>';
  } else {
    contenedor.innerHTML = data.map(s => `
      <div class="curso-card">
        <div class="curso-banner">
          <span class="curso-etiqueta">${s.codigo}</span>
        </div>
        <div class="curso-body">
          <h4>${s.nombre}</h4>
          <div class="curso-meta">${s.periodo}</div>
          <p style="font-size:0.85rem; color:var(--plata); margin-bottom:12px;">${s.descripcion || ''}</p>
          <p style="font-size:0.78rem; color:var(--plata);">📋 Código para compartir: <strong style="color:var(--azul-marino);">${s.codigo}</strong></p>
        </div>
      </div>
    `).join('');
  }

  // Estadísticas: total de tareas y estudiantes
  const ids = misSeccionesCache.map(s => s.id);
  if (ids.length > 0) {
    const { count: tareasCount } = await supabase.from('tareas').select('*', { count: 'exact', head: true }).in('seccion_id', ids);
    document.getElementById('stat-tareas-prof').textContent = tareasCount ?? 0;

    const { data: inscripciones } = await supabase.from('inscripciones').select('estudiante_id').in('seccion_id', ids);
    const unicos = new Set((inscripciones || []).map(i => i.estudiante_id));
    document.getElementById('stat-estudiantes-prof').textContent = unicos.size;
  } else {
    document.getElementById('stat-tareas-prof').textContent = 0;
    document.getElementById('stat-estudiantes-prof').textContent = 0;
  }
}

async function crearSeccion() {
  const nombre = document.getElementById('nueva-nombre').value.trim();
  const codigo = document.getElementById('nueva-codigo').value.trim().toUpperCase();
  const periodo = document.getElementById('nueva-periodo').value.trim();
  const descripcion = document.getElementById('nueva-descripcion').value.trim();
  const msg = document.getElementById('msg-seccion');

  if (!nombre || !codigo || !periodo) {
    msg.style.color = '#c0392b';
    msg.textContent = 'Nombre, código y periodo son obligatorios.';
    return;
  }

  const { error } = await supabase.from('secciones').insert({
    nombre, codigo, periodo, descripcion,
    profesor_id: usuarioActual.id
  });

  if (error) {
    msg.style.color = '#c0392b';
    msg.textContent = error.message.includes('unique') ? 'Ese código ya existe, usa uno diferente.' : 'Error al crear la sección.';
    return;
  }

  msg.style.color = '#27ae60';
  msg.textContent = '¡Sección creada con éxito!';
  document.getElementById('nueva-nombre').value = '';
  document.getElementById('nueva-codigo').value = '';
  document.getElementById('nueva-periodo').value = '';
  document.getElementById('nueva-descripcion').value = '';
  cargarSecciones();
}

async function cargarSelectSecciones(selectId) {
  const { data } = await supabase.from('secciones').select('id, nombre, codigo').eq('profesor_id', usuarioActual.id);
  misSeccionesCache = data || [];
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = data && data.length > 0
    ? data.map(s => `<option value="${s.id}">${s.nombre} (${s.codigo})</option>`).join('')
    : '<option value="">Sin secciones creadas</option>';
}

async function crearTarea() {
  const seccion_id = document.getElementById('tarea-seccion').value;
  const titulo = document.getElementById('tarea-titulo').value.trim();
  const descripcion = document.getElementById('tarea-descripcion').value.trim();
  const fecha_limite = document.getElementById('tarea-fecha').value;
  const puntos = parseInt(document.getElementById('tarea-puntos').value);
  const msg = document.getElementById('msg-tarea');

  if (!seccion_id || !titulo) {
    msg.style.color = '#c0392b';
    msg.textContent = 'La clase y el título son obligatorios.';
    return;
  }

  const { error } = await supabase.from('tareas').insert({
    seccion_id, titulo, descripcion,
    fecha_limite: fecha_limite || null,
    puntos: isNaN(puntos) ? 100 : puntos
  });

  if (error) { msg.style.color = '#c0392b'; msg.textContent = 'Error al publicar la tarea.'; return; }

  msg.style.color = '#27ae60';
  msg.textContent = '¡Tarea publicada!';
  document.getElementById('tarea-titulo').value = '';
  document.getElementById('tarea-descripcion').value = '';
  document.getElementById('tarea-fecha').value = '';
  cargarTareasProfesor();
}

async function cargarTareasProfesor() {
  const ids = misSeccionesCache.map(s => s.id);
  if (ids.length === 0) return;

  const { data } = await supabase.from('tareas').select('*, secciones(nombre)').in('seccion_id', ids).order('created_at', { ascending: false });
  const contenedor = document.getElementById('lista-tareas-prof');

  if (!data || data.length === 0) {
    contenedor.innerHTML = '<div class="tarjeta"><p style="color:var(--plata);">No has publicado tareas aún.</p></div>';
    return;
  }

  contenedor.innerHTML = data.map(t => `
    <div class="tarjeta">
      <div style="display:flex; justify-content:space-between;">
        <div>
          <h3>${t.titulo}</h3>
          <p style="color:var(--plata); font-size:0.85rem;">Clase: ${t.secciones.nombre} · Puntos: ${t.puntos}</p>
          ${t.fecha_limite ? `<p style="font-size:0.85rem; margin-top:4px;">📅 Vence: ${new Date(t.fecha_limite).toLocaleDateString('es-HN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>` : ''}
          <p style="margin-top:8px; font-size:0.9rem;">${t.descripcion || ''}</p>
        </div>
      </div>
    </div>
  `).join('');
}

async function subirMaterial() {
  const seccion_id = document.getElementById('mat-seccion').value;
  const titulo = document.getElementById('mat-titulo').value.trim();
  const descripcion = document.getElementById('mat-descripcion').value.trim();
  const archivo = document.getElementById('mat-archivo').files[0];
  const msg = document.getElementById('msg-material');

  if (!seccion_id || !titulo || !archivo) {
    msg.style.color = '#c0392b';
    msg.textContent = 'Clase, título y archivo son obligatorios.';
    return;
  }

  msg.style.color = '#6d7988';
  msg.textContent = 'Subiendo archivo...';

  const ext = archivo.name.split('.').pop();
  const ruta = `documentos/${seccion_id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('documentos').upload(ruta, archivo);

  if (uploadError) { msg.style.color = '#c0392b'; msg.textContent = 'Error al subir el archivo.'; return; }

  const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(ruta);

  const { error } = await supabase.from('documentos').insert({
    seccion_id, titulo, descripcion,
    archivo_url: urlData.publicUrl,
    subido_por: usuarioActual.id
  });

  if (error) { msg.style.color = '#c0392b'; msg.textContent = 'Error al registrar el documento.'; return; }

  msg.style.color = '#27ae60';
  msg.textContent = '¡Material subido con éxito!';
  document.getElementById('mat-titulo').value = '';
  document.getElementById('mat-descripcion').value = '';
  document.getElementById('mat-archivo').value = '';
  cargarMateriales();
}

async function cargarMateriales() {
  const ids = misSeccionesCache.map(s => s.id);
  if (ids.length === 0) return;

  const { data } = await supabase.from('documentos').select('*, secciones(nombre)').in('seccion_id', ids).order('created_at', { ascending: false });
  const contenedor = document.getElementById('lista-materiales-prof');

  if (!data || data.length === 0) {
    contenedor.innerHTML = '<div class="tarjeta"><p style="color:var(--plata);">No has subido materiales aún.</p></div>';
    return;
  }

  contenedor.innerHTML = `
    <div class="tarjeta">
      <table>
        <thead><tr><th>Título</th><th>Clase</th><th>Fecha</th><th>Acción</th></tr></thead>
        <tbody>
          ${data.map(d => `
            <tr>
              <td>${d.titulo}<br/><small style="color:var(--plata);">${d.descripcion || ''}</small></td>
              <td>${d.secciones.nombre}</td>
              <td>${new Date(d.created_at).toLocaleDateString('es-HN')}</td>
              <td><a href="${d.archivo_url}" target="_blank" class="btn btn-celeste" style="text-decoration:none; font-size:0.8rem;">⬇ Ver</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function cargarSelectTareasCalif() {
  await cargarSelectSecciones('tarea-seccion');
  const ids = misSeccionesCache.map(s => s.id);
  if (ids.length === 0) return;

  const { data } = await supabase.from('tareas').select('id, titulo, secciones(nombre)').in('seccion_id', ids);
  const sel = document.getElementById('select-tarea-calif');
  sel.innerHTML = data && data.length > 0
    ? data.map(t => `<option value="${t.id}">${t.titulo} — ${t.secciones.nombre}</option>`).join('')
    : '<option value="">Sin tareas publicadas</option>';

  if (data && data.length > 0) cargarEntregas();
}

async function cargarEntregas() {
  const tareaId = document.getElementById('select-tarea-calif').value;
  if (!tareaId) return;

  const { data } = await supabase
    .from('entregas')
    .select('*, perfiles(nombre, numero_cuenta)')
    .eq('tarea_id', tareaId);

  const contenedor = document.getElementById('lista-entregas');
  if (!data || data.length === 0) {
    contenedor.innerHTML = '<div class="tarjeta"><p style="color:var(--plata);">Ningún estudiante ha entregado esta tarea aún.</p></div>';
    return;
  }

  contenedor.innerHTML = `
    <div class="tarjeta">
      <table>
        <thead><tr><th>Estudiante</th><th>Cuenta</th><th>Entregado</th><th>Archivo</th><th>Calificación</th><th></th></tr></thead>
        <tbody>
          ${data.map(e => `
            <tr>
              <td>${e.perfiles.nombre}</td>
              <td>${e.perfiles.numero_cuenta || '—'}</td>
              <td>${new Date(e.entregado_at).toLocaleDateString('es-HN')}</td>
              <td>${e.archivo_url ? `<a href="${e.archivo_url}" target="_blank" class="btn btn-celeste" style="text-decoration:none; font-size:0.8rem;">Ver</a>` : '—'}</td>
              <td><input type="number" id="cal-${e.id}" value="${e.calificacion ?? ''}" min="0" max="100"
                style="width:70px; padding:6px; border:1.5px solid #e4e9ef; border-radius:8px;"/></td>
              <td><button class="btn btn-verde" style="font-size:0.8rem;" onclick="guardarCalificacion('${e.id}')">Guardar</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function guardarCalificacion(entregaId) {
  const valor = parseInt(document.getElementById('cal-' + entregaId).value);
  if (isNaN(valor) || valor < 0 || valor > 100) {
    alert('Ingresa una calificación entre 0 y 100.');
    return;
  }

  const { error } = await supabase.from('entregas').update({ calificacion: valor }).eq('id', entregaId);
  if (error) { alert('Error al guardar.'); return; }
  alert('Calificación guardada.');
}

async function cargarEstudiantes() {
  const seccionId = document.getElementById('select-seccion-est').value;
  if (!seccionId) return;

  const { data } = await supabase
    .from('inscripciones')
    .select('perfiles(nombre, email, numero_cuenta)')
    .eq('seccion_id', seccionId);

  const contenedor = document.getElementById('lista-estudiantes');
  if (!data || data.length === 0) {
    contenedor.innerHTML = '<div class="tarjeta"><p style="color:var(--plata);">Ningún estudiante inscrito en esta clase aún.</p></div>';
    return;
  }

  contenedor.innerHTML = `
    <div class="tarjeta">
      <p style="margin-bottom:12px; color:var(--plata);">${data.length} estudiante(s) inscritos</p>
      <table>
        <thead><tr><th>#</th><th>Nombre</th><th>Correo</th><th>Número de Cuenta</th></tr></thead>
        <tbody>
          ${data.map((i, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${i.perfiles.nombre}</td>
              <td>${i.perfiles.email}</td>
              <td>${i.perfiles.numero_cuenta || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function cerrarSesion() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

init();
