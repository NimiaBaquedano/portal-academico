let usuarioActual = null;
let todosLosUsuarios = [];

async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.href = 'index.html'; return; }

  const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
  if (!perfil || perfil.rol !== 'admin') { window.location.href = 'index.html'; return; }

  usuarioActual = perfil;
document.getElementById('titulo-bienvenida').textContent = `Panel de Administración — ${perfil.nombre.split(' ')[0]} 👋`;
  cargarResumen();
}

function mostrarSeccion(nombre) {
  ['resumen','usuarios','secciones','crear-usuario'].forEach(s => {
    document.getElementById('seccion-' + s).style.display = 'none';
  });
  document.getElementById('seccion-' + nombre).style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('activo'));
  event.target.classList.add('activo');

  if (nombre === 'usuarios') cargarUsuarios();
  if (nombre === 'secciones') cargarSeccionesAdmin();
}

async function cargarResumen() {
  const [{ count: estCount }, { count: profCount }, { count: secCount }, { count: tarCount }] = await Promise.all([
    supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('rol', 'estudiante'),
    supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('rol', 'profesor'),
    supabase.from('secciones').select('*', { count: 'exact', head: true }),
    supabase.from('tareas').select('*', { count: 'exact', head: true })
  ]);

  document.getElementById('total-estudiantes').textContent = estCount ?? 0;
  document.getElementById('total-profesores').textContent = profCount ?? 0;
  document.getElementById('total-secciones').textContent = secCount ?? 0;
  document.getElementById('total-tareas').textContent = tarCount ?? 0;

  const { data: recientes } = await supabase
    .from('perfiles')
    .select('nombre, email, rol, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  const contenedor = document.getElementById('actividad-reciente');
  if (!recientes || recientes.length === 0) {
    contenedor.innerHTML = '<p style="color:#888;">No hay registros aún.</p>';
    return;
  }

  contenedor.innerHTML = `
    <table>
      <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Registrado</th></tr></thead>
      <tbody>
        ${recientes.map(u => `
          <tr>
            <td>${u.nombre}</td>
            <td>${u.email}</td>
            <td><span class="badge ${u.rol === 'profesor' ? 'badge-amarillo' : u.rol === 'admin' ? 'badge-rojo' : 'badge-verde'}">${u.rol}</span></td>
            <td>${new Date(u.created_at).toLocaleDateString('es-HN')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function cargarUsuarios() {
  const { data } = await supabase
    .from('perfiles')
    .select('*')
    .order('created_at', { ascending: false });

  todosLosUsuarios = data || [];
  renderizarUsuarios(todosLosUsuarios);
}

function filtrarUsuarios() {
  const texto = document.getElementById('buscar-usuario').value.toLowerCase();
  const rol = document.getElementById('filtro-rol').value;

  const filtrados = todosLosUsuarios.filter(u => {
    const coincideTexto = u.nombre.toLowerCase().includes(texto) || u.email.toLowerCase().includes(texto);
    const coincideRol = rol === '' || u.rol === rol;
    return coincideTexto && coincideRol;
  });

  renderizarUsuarios(filtrados);
}

function renderizarUsuarios(usuarios) {
  const contenedor = document.getElementById('lista-usuarios');
  if (!usuarios || usuarios.length === 0) {
    contenedor.innerHTML = '<div class="tarjeta"><p style="color:#888;">No se encontraron usuarios.</p></div>';
    return;
  }

  contenedor.innerHTML = `
    <div class="tarjeta">
      <p style="margin-bottom:12px; color:#555;">${usuarios.length} usuario(s)</p>
      <table>
        <thead><tr><th>Nombre</th><th>Correo</th><th>Cuenta</th><th>Rol</th><th>Cambiar rol</th></tr></thead>
        <tbody>
          ${usuarios.map(u => `
            <tr>
              <td>${u.nombre}</td>
              <td>${u.email}</td>
              <td>${u.numero_cuenta || '—'}</td>
              <td><span class="badge ${u.rol === 'profesor' ? 'badge-amarillo' : u.rol === 'admin' ? 'badge-rojo' : 'badge-verde'}">${u.rol}</span></td>
              <td>
                <select onchange="cambiarRol('${u.id}', this.value)"
                  style="padding:5px; border:1px solid #ddd; border-radius:6px; font-size:0.85rem;">
                  <option value="estudiante" ${u.rol === 'estudiante' ? 'selected' : ''}>Estudiante</option>
                  <option value="profesor" ${u.rol === 'profesor' ? 'selected' : ''}>Profesor</option>
                  <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function cambiarRol(userId, nuevoRol) {
  const { error } = await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', userId);
  if (error) { alert('Error al cambiar el rol.'); return; }
  alert('Rol actualizado correctamente.');
  cargarUsuarios();
}

async function cargarSeccionesAdmin() {
  const { data } = await supabase
    .from('secciones')
    .select('*, perfiles(nombre)')
    .order('created_at', { ascending: false });

  const contenedor = document.getElementById('lista-secciones-admin');
  if (!data || data.length === 0) {
    contenedor.innerHTML = '<div class="tarjeta"><p style="color:#888;">No hay secciones creadas aún.</p></div>';
    return;
  }

  contenedor.innerHTML = `
    <div class="tarjeta">
      <table>
        <thead><tr><th>Nombre</th><th>Código</th><th>Periodo</th><th>Profesor</th><th>Acción</th></tr></thead>
        <tbody>
          ${data.map(s => `
            <tr>
              <td>${s.nombre}</td>
              <td><strong>${s.codigo}</strong></td>
              <td>${s.periodo}</td>
              <td>${s.perfiles?.nombre || '—'}</td>
              <td><button class="btn btn-rojo" style="font-size:0.8rem;" onclick="eliminarSeccion('${s.id}', '${s.nombre.replace(/'/g,"\\'")}')">Eliminar</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function eliminarSeccion(seccionId, nombre) {
  if (!confirm(`¿Seguro que quieres eliminar la sección "${nombre}"? Se eliminarán también sus tareas, materiales e inscripciones.`)) return;

  const { error } = await supabase.from('secciones').delete().eq('id', seccionId);
  if (error) { alert('Error al eliminar.'); return; }
  alert('Sección eliminada.');
  cargarSeccionesAdmin();
}

async function crearUsuario() {
  const nombre = document.getElementById('cu-nombre').value.trim();
  const email = document.getElementById('cu-email').value.trim();
  const password = document.getElementById('cu-password').value;
  const cuenta = document.getElementById('cu-cuenta').value.trim();
  const rol = document.getElementById('cu-rol').value;
  const grado = document.getElementById('cu-grado').value;
  const msg = document.getElementById('msg-crear-usuario');

  if (!nombre || !email || !password) {
    msg.style.color = '#c0392b';
    msg.textContent = 'Nombre, correo y contraseña son obligatorios.';
    return;
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) { msg.style.color = '#c0392b'; msg.textContent = 'Error: ' + error.message; return; }

  const { error: perfilError } = await supabase.from('perfiles').insert({
    id: data.user.id,
    nombre, email, rol,
    numero_cuenta: cuenta || null,
    grado: rol === 'estudiante' ? (grado || null) : null
  });

  if (perfilError) { msg.style.color = '#c0392b'; msg.textContent = 'Error al crear perfil: ' + perfilError.message; return; }

  msg.style.color = '#27ae60';
  msg.textContent = `¡Usuario "${nombre}" creado como ${rol}!`;
  document.getElementById('cu-nombre').value = '';
  document.getElementById('cu-email').value = '';
  document.getElementById('cu-password').value = '';
  document.getElementById('cu-cuenta').value = '';
  document.getElementById('cu-grado').value = '';
}

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) { msg.style.color = '#e53e3e'; msg.textContent = 'Error: ' + error.message; return; }

  const { error: perfilError } = await supabase.from('perfiles').insert({
    id: data.user.id,
    nombre, email, rol,
    numero_cuenta: cuenta || null
  });

  if (perfilError) { msg.style.color = '#e53e3e'; msg.textContent = 'Error al crear perfil: ' + perfilError.message; return; }

  msg.style.color = '#38a169';
  msg.textContent = `¡Usuario "${nombre}" creado como ${rol}!`;
  document.getElementById('cu-nombre').value = '';
  document.getElementById('cu-email').value = '';
  document.getElementById('cu-password').value = '';
  document.getElementById('cu-cuenta').value = '';
}

async function cerrarSesion() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

init();
