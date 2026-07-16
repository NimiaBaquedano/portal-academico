function mostrarTab(tab) {
  document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('form-registro').style.display = tab === 'registro' ? 'block' : 'none';
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('activo'));
  event.target.classList.add('activo');
}

async function iniciarSesion(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    errorEl.textContent = 'Correo o contraseña incorrectos.';
    return;
  }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', data.user.id)
    .single();

  if (!perfil) {
    errorEl.textContent = 'No se encontró tu perfil. Contacta al administrador.';
    return;
  }

  if (perfil.rol === 'admin') window.location.href = 'dashboard-admin.html';
  else if (perfil.rol === 'profesor') window.location.href = 'dashboard-profesor.html';
  else window.location.href = 'dashboard-estudiante.html';
}

async function registrarse(e) {
  e.preventDefault();
  const nombre = document.getElementById('reg-nombre').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const rol = document.getElementById('reg-rol').value;
  const cuenta = document.getElementById('reg-cuenta').value;
  const errorEl = document.getElementById('reg-error');
  const exitoEl = document.getElementById('reg-exito');

  errorEl.textContent = '';
  exitoEl.textContent = '';

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    errorEl.textContent = 'Error al crear cuenta: ' + error.message;
    return;
  }

  const { error: perfilError } = await supabase.from('perfiles').insert({
    id: data.user.id,
    nombre,
    email,
    rol,
    numero_cuenta: cuenta
  });

  if (perfilError) {
    errorEl.textContent = 'Error al guardar perfil: ' + perfilError.message;
    return;
  }

  exitoEl.textContent = '¡Cuenta creada! Ya puedes iniciar sesión.';
}

function togglePassword(inputId, icono) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    icono.textContent = '◉';
  } else {
    input.type = 'password';
    icono.textContent = '◎';
  }
}
  }
}
