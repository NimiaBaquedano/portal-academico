let usuarioActual = null;
let tareaSeleccionada = null;

async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.href = 'index.html'; return; }

  const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
  if (!perfil || perfil.rol !== 'estudiante') { window.location.href = 'index.html'; return; }

 usuarioActual = perfil;
document.getElementById('nombre-usuario').textContent = perfil.nombre;
cargarClases();
dibujarCalendario();
cargarProximosEventos();
}

function mostrarSeccion(nombre) {
  ['mis-clases','tareas','materiales','calificaciones'].forEach(s => {
    document.getElementById('seccion-' + s).style.display = 'none';
  });
  document.getElementById('seccion-' + nombre).style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('activo'));
  event.target.classList.add('activo');

  if (nombre === 'tareas') cargarTareas();
  if (nombre === 'materiales') cargarMateriales();
  if (nombre === 'calificaciones') cargarCalificaciones();
}

async function cargarClases() {
  const { data } = await supabase
    .from('inscripciones')
    .select('seccion_id, secciones(id, nombre, codigo, descripcion, periodo, perfiles(nombre))')
    .eq('estudiante_id', usuarioActual.id);

  document.getElementById('titulo-bienvenida').textContent = `¡Bienvenido/a, ${usuarioActual.nombre.split(' ')[0]}! 👋`;
  document.getElementById('stat-clases').textContent = data ? data.length : 0;

  const contenedor = document.getElementById('lista-clases');
  if (!data || data.length === 0) {
    contenedor.innerHTML = '<div class="tarjeta"><p style="color:var(--plata);">No estás inscrito en ninguna clase aún. Usa el código de tu profesor para inscribirte.</p></div>';
  } else {
    contenedor.innerHTML = data.map(i => `
      <div class="curso-card">
        <div class="curso-banner">
          <span class="curso-etiqueta">${i.secciones.codigo}</span>
        </div>
        <div class="curso-body">
          <h4>${i.secciones.nombre}</h4>
          <div class="curso-meta">👨‍🏫 ${i.secciones.perfiles?.nombre || 'Sin asignar'} · ${i.secciones.periodo}</div>
          <p style="font-size:0.85rem; color:var(--plata); margin-bottom:12px;">${i.secciones.descripcion || ''}</p>
        </div>
      </div>
    `).join('');
  }

  if (data && data.length > 0) {
    const ids = data.map(i => i.seccion_id);
    const { data: tareas } = await supabase.from('tareas').select('id').in('seccion_id', ids);
    const { data: entregas } = await supabase.from('entregas').select('tarea_id, calificacion').eq('estudiante_id', usuarioActual.id);
    const entregadasIds = new Set((entregas || []).map(e => e.tarea_id));
    const pendientes = (tareas || []).filter(t => !entregadasIds.has(t.id)).length;
    document.getElementById('stat-tareas-pend').textContent = pendientes;

    const calificadas = (entregas || []).filter(e => e.calificacion !== null);
    if (calificadas.length > 0) {
      const prom = calificadas.reduce((acc, e) => acc + e.calificacion, 0) / calificadas.length;
      document.getElementById('stat-promedio').textContent = prom.toFixed(1);
    }
  }
}

async function inscribirse() {
  const codigo = document.getElementById('codigo-seccion').value.trim().toUpperCase();
  const msg = document.getElementById('msg-inscripcion');
  if (!codigo) return;

  const { data: seccion } = await supabase.from('secciones').select('id, nombre, grado').eq('codigo', codigo).single();
  if (!seccion) { msg.style.color = '#c0392b'; msg.textContent = 'Código no encontrado.'; return; }

  if (seccion.grado !== usuarioActual.grado) {
    msg.style.color = '#c0392b';
    msg.textContent = `Esta clase es para ${seccion.grado}. Tú estás en ${usuarioActual.grado}.`;
    return;
  }

  const { error } = await supabase.from('inscripciones').insert({ estudiante_id: usuarioActual.id, seccion_id: seccion.id });
  if (error) { msg.style.color = '#c0392b'; msg.textContent = 'Ya estás inscrito o ocurrió un error.'; return; }

  msg.style.color = '#27ae60';
  msg.textContent = `¡Inscrito en ${seccion.nombre}!`;
  document.getElementById('codigo-seccion').value = '';
  cargarClases();
}.value = '';
  cargarClases();
}

async function cargarTareas() {
  const { data: inscripciones } = await supabase.from('inscripciones').select('seccion_id').eq('estudiante_id', usuarioActual.id);
  if (!inscripciones || inscripciones.length === 0) {
    document.getElementById('lista-tareas').innerHTML = '<div class="tarjeta"><p style="color:var(--plata);">No tienes clases inscritas.</p></div>';
    return;
  }

  const ids = inscripciones.map(i => i.seccion_id);
  const { data: tareas } = await supabase.from('tareas').select('*, secciones(nombre)').in('seccion_id', ids).order('fecha_limite');
  const { data: entregas } = await supabase.from('entregas').select('tarea_id').eq('estudiante_id', usuarioActual.id);
  const entregadas = new Set((entregas || []).map(e => e.tarea_id));

  const contenedor = document.getElementById('lista-tareas');
  if (!tareas || tareas.length === 0) {
    contenedor.innerHTML = '<div class="tarjeta"><p style="color:var(--plata);">No hay tareas publicadas aún.</p></div>';
    return;
  }

  contenedor.innerHTML = tareas.map(t => {
    const yaEntrego = entregadas.has(t.id);
    const vencida = t.fecha_limite && new Date(t.fecha_limite) < new Date();
    const estado = yaEntrego ? '<span class="badge badge-verde">Entregada</span>' : vencida ? '<span class="badge badge-rojo">Vencida</span>' : '<span class="badge badge-amarillo">Pendiente</span>';
    return `
      <div class="tarjeta">
        <div style="display:flex; justify-content:space-between; align-items:start;">
          <div>
            <h3>${t.titulo}</h3>
            <p style="color:var(--plata); font-size:0.85rem;">Clase: ${t.secciones.nombre} · Puntos: ${t.puntos}</p>
            ${t.fecha_limite ? `<p style="font-size:0.85rem; margin-top:4px;">📅 Vence: ${new Date(t.fecha_limite).toLocaleDateString('es-HN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>` : ''}
            <p style="margin-top:8px; font-size:0.9rem;">${t.descripcion || ''}</p>
          </div>
          <div>${estado}</div>
        </div>
        ${!yaEntrego && !vencida ? `<button class="btn btn-celeste" style="margin-top:12px;" onclick="abrirModal('${t.id}','${t.titulo.replace(/'/g,"\\'")}')">Entregar</button>` : ''}
      </div>
    `;
  }).join('');
}

function abrirModal(tareaId, titulo) {
  tareaSeleccionada = tareaId;
  document.getElementById('modal-tarea-titulo').textContent = titulo;
  document.getElementById('modal-entrega').style.display = 'flex';
  document.getElementById('msg-entrega').textContent = '';
}

function cerrarModal() {
  document.getElementById('modal-entrega').style.display = 'none';
  tareaSeleccionada = null;
}

async function subirEntrega() {
  const archivo = document.getElementById('archivo-entrega').files[0];
  const comentario = document.getElementById('comentario-entrega').value;
  const msg = document.getElementById('msg-entrega');

  let archivoUrl = null;

  if (archivo) {
    const ext = archivo.name.split('.').pop();
    const ruta = `entregas/${usuarioActual.id}/${tareaSeleccionada}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('entregas').upload(ruta, archivo, { upsert: true });
    if (uploadError) { msg.style.color = '#c0392b'; msg.textContent = 'Error al subir el archivo.'; return; }
    const { data: urlData } = supabase.storage.from('entregas').getPublicUrl(ruta);
    archivoUrl = urlData.publicUrl;
  }

  const { error } = await supabase.from('entregas').insert({
    tarea_id: tareaSeleccionada,
    estudiante_id: usuarioActual.id,
    archivo_url: archivoUrl,
    comentario
  });

  if (error) { msg.style.color = '#c0392b'; msg.textContent = 'Error al registrar la entrega.'; return; }

  msg.style.color = '#27ae60';
  msg.textContent = '¡Tarea entregada con éxito!';
  setTimeout(() => { cerrarModal(); cargarTareas(); }, 1500);
}

async function cargarMateriales() {
  const { data: inscripciones } = await supabase.from('inscripciones').select('seccion_id').eq('estudiante_id', usuarioActual.id);
  if (!inscripciones || inscripciones.length === 0) {
    document.getElementById('lista-materiales').innerHTML = '<div class="tarjeta"><p style="color:var(--plata);">No tienes clases inscritas.</p></div>';
    return;
  }

  const ids = inscripciones.map(i => i.seccion_id);
  const { data } = await supabase.from('documentos').select('*, secciones(nombre)').in('seccion_id', ids).order('created_at', { ascending: false });

  const contenedor = document.getElementById('lista-materiales');
  if (!data || data.length === 0) {
    contenedor.innerHTML = '<div class="tarjeta"><p style="color:var(--plata);">No hay materiales publicados aún.</p></div>';
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
              <td><a href="${d.archivo_url}" target="_blank" class="btn btn-celeste" style="text-decoration:none; font-size:0.8rem;">⬇ Descargar</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function cargarCalificaciones() {
  const { data } = await supabase
    .from('entregas')
    .select('calificacion, comentario, tarea_id, tareas(titulo, puntos, secciones(nombre))')
    .eq('estudiante_id', usuarioActual.id);

  const contenedor = document.getElementById('lista-calificaciones');
  if (!data || data.length === 0) {
    contenedor.innerHTML = '<div class="tarjeta"><p style="color:var(--plata);">Aún no tienes calificaciones.</p></div>';
    return;
  }

  contenedor.innerHTML = `
    <div class="tarjeta">
      <table>
        <thead><tr><th>Tarea</th><th>Clase</th><th>Puntos</th><th>Calificación</th></tr></thead>
        <tbody>
          ${data.map(e => `
            <tr>
              <td>${e.tareas.titulo}</td>
              <td>${e.tareas.secciones.nombre}</td>
              <td>${e.tareas.puntos}</td>
              <td>${e.calificacion !== null ? `<strong>${e.calificacion}</strong>` : '<span style="color:var(--plata);">Sin calificar</span>'}</td>
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
let mesCalendario = new Date();

function cambiarMes(delta) {
  mesCalendario.setMonth(mesCalendario.getMonth() + delta);
  dibujarCalendario();
}

function dibujarCalendario() {
  const nombresMes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const nombresDia = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const hoy = new Date();

  const anio = mesCalendario.getFullYear();
  const mes = mesCalendario.getMonth();

  document.getElementById('calendario-mes-label').textContent = `${nombresMes[mes]} ${anio}`;

  const primerDia = new Date(anio, mes, 1);
  let diaSemanaInicio = primerDia.getDay();
  diaSemanaInicio = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1;

  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const diasMesAnterior = new Date(anio, mes, 0).getDate();

  let celdas = nombresDia.map(d => `<div class="dia-nombre">${d}</div>`).join('');

  for (let i = diaSemanaInicio; i > 0; i--) {
    celdas += `<div class="dia-numero otro-mes">${diasMesAnterior - i + 1}</div>`;
  }

  for (let d = 1; d <= diasEnMes; d++) {
    const esHoy = d === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear();
    celdas += `<div class="dia-numero ${esHoy ? 'hoy' : ''}">${d}</div>`;
  }

  document.getElementById('calendario-grid').innerHTML = celdas;
}

async function cargarProximosEventos() {
  const { data: inscripciones } = await supabase.from('inscripciones').select('seccion_id').eq('estudiante_id', usuarioActual.id);
  const contenedor = document.getElementById('lista-proximos-eventos');

  if (!inscripciones || inscripciones.length === 0) {
    contenedor.innerHTML = '<p style="font-size:0.82rem; color:var(--plata);">No tienes eventos próximos.</p>';
    return;
  }

  const ids = inscripciones.map(i => i.seccion_id);
  const { data: tareas } = await supabase
    .from('tareas')
    .select('titulo, fecha_limite, secciones(nombre)')
    .in('seccion_id', ids)
    .not('fecha_limite', 'is', null)
    .gte('fecha_limite', new Date().toISOString())
    .order('fecha_limite')
    .limit(4);

  if (!tareas || tareas.length === 0) {
    contenedor.innerHTML = '<p style="font-size:0.82rem; color:var(--plata);">No tienes eventos próximos.</p>';
    return;
  }

  contenedor.innerHTML = tareas.map(t => `
    <div class="evento-item">
      <div class="evento-icono">📝</div>
      <div>
        <div class="evento-titulo">Entrega: ${t.titulo}</div>
        <div class="evento-meta">${t.secciones.nombre} · ${new Date(t.fecha_limite).toLocaleDateString('es-HN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</div>
      </div>
    </div>
  `).join('');
}
