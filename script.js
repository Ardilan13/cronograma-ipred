let datosOriginales = null;
let semanaActual = 0; // 0 = semana actual, -1 = anterior, 1 = siguiente

function formatearFecha(fechaStr) {
  const fecha = new Date(fechaStr);
  const opciones = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return fecha.toLocaleDateString("es-ES", opciones);
}

function formatearHora(fechaStr) {
  const fecha = new Date(fechaStr);
  return fecha.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSemana(offset = 0) {
  const hoy = new Date();

  // Aplicar offset de semanas
  hoy.setDate(hoy.getDate() + offset * 7);

  const dia = hoy.getDay(); // 0=Dom, 1=Lun, 6=Sáb

  // Si hoy es sábado (6) o domingo (0), saltamos a la próxima semana
  if (dia === 6) {
    hoy.setDate(hoy.getDate() + 2); // Lunes siguiente
  } else if (dia === 0) {
    hoy.setDate(hoy.getDate() + 1); // Lunes siguiente
  }

  // Lunes de la semana
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (hoy.getDay() - 1));

  // Domingo de la semana
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  return { lunes, domingo };
}

function actualizarInfoSemana() {
  const { lunes, domingo } = getSemana(semanaActual);
  const weekInfo = document.getElementById("weekInfo");

  const formateoFecha = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const lunesStr = lunes.toLocaleDateString("es-ES", formateoFecha);
  const domingoStr = domingo.toLocaleDateString("es-ES", formateoFecha);

  let tipoSemana = "";
  if (semanaActual === 0) tipoSemana = "(Semana Actual)";
  else if (semanaActual < 0) tipoSemana = "(Semana Pasada)";
  else tipoSemana = "(Próxima Semana)";

  weekInfo.innerHTML = `📅 ${lunesStr} - ${domingoStr} ${tipoSemana}`;
}

function cambiarSemana(direccion) {
  semanaActual += direccion;
  actualizarInfoSemana();

  if (datosOriginales) {
    aplicarFiltros();
  }
}

function fechaEstaEnSemana(fechaStr, semanaOffset) {
  const fecha = new Date(fechaStr + " 00:00:00");
  const { lunes, domingo } = getSemana(semanaOffset);

  // Normalizar fechas para comparar solo el día
  lunes.setHours(0, 0, 0, 0);
  domingo.setHours(23, 59, 59, 999);
  fecha.setHours(0, 0, 0, 0);

  return fecha >= lunes && fecha <= domingo;
}

function filtrarPorGrupoYSemana(datos, grupoSeleccionado, semanaOffset) {
  if (!datos || datos.length === 0) return datos;

  // Si la API devuelve un array, usamos el primer elemento
  const datosNormalizados = Array.isArray(datos) ? datos[0] : datos;
  const datosFiltrados = {};

  Object.keys(datosNormalizados).forEach((programa) => {
    datosFiltrados[programa] = {};

    Object.keys(datosNormalizados[programa]).forEach((nivel) => {
      const cursos = datosNormalizados[programa][nivel];
      if (!Array.isArray(cursos)) return;

      const cursosFiltrados = cursos
        .map((curso) => {
          const actividadesFiltradas = curso.actividades.filter((actividad) => {
            // Filtrar por grupo
            const pasaFiltroGrupo =
              !grupoSeleccionado || actividad.grupo === grupoSeleccionado;

            // Filtrar por semana
            const fechaSolo = actividad.fecha_inicio.split(" ")[0];
            const pasaFiltroSemana = fechaEstaEnSemana(fechaSolo, semanaOffset);

            return pasaFiltroGrupo && pasaFiltroSemana;
          });

          return {
            ...curso,
            actividades: actividadesFiltradas,
          };
        })
        .filter((curso) => curso.actividades.length > 0); // Solo cursos con actividades

      if (cursosFiltrados.length > 0) {
        datosFiltrados[programa][nivel] = cursosFiltrados;
      }
    });
  });

  return [datosFiltrados];
}

function organizarPorFecha(datos) {
  const actividadesPorFecha = {};

  // Si la API devuelve un array, usamos el primer elemento
  const datosNormalizados = Array.isArray(datos) ? datos[0] : datos;

  Object.keys(datosNormalizados).forEach((programa) => {
    Object.keys(datosNormalizados[programa]).forEach((nivel) => {
      const cursos = datosNormalizados[programa][nivel];
      if (!Array.isArray(cursos)) return;

      cursos.forEach((curso) => {
        curso.actividades.forEach((actividad) => {
          const fechaSolo = actividad.fecha_inicio.split(" ")[0];
          if (!actividadesPorFecha[fechaSolo]) {
            actividadesPorFecha[fechaSolo] = [];
          }
          actividadesPorFecha[fechaSolo].push({
            ...actividad,
            nombre_asignatura: curso.nombre_asignatura,
            nombre_profesor: curso.nombre_profesor,
            capacidad: curso.capacidad,
          });
        });
      });
    });
  });

  return actividadesPorFecha;
}

function crearTablaCalendario(datos) {
  const actividadesPorFecha = organizarPorFecha(datos);
  const fechasOrdenadas = Object.keys(actividadesPorFecha).sort();

  if (fechasOrdenadas.length === 0) {
    return '<div class="no-data">📅 No hay actividades para la semana y grupo seleccionados</div>';
  }

  let html = `
          <div class="calendar-container">
              <table class="calendar-table">
                  <thead>
                      <tr>
                          <th>📅 Fecha</th>
                          <th>📚 Actividades</th>
                      </tr>
                  </thead>
                  <tbody>
        `;

  fechasOrdenadas.forEach((fecha) => {
    const actividades = actividadesPorFecha[fecha];

    html += `
            <tr>
                <td class="date-cell">
                    <strong>${formatearFecha(fecha + " 12:00:00")}</strong>
                </td>
                <td class="activity-cell">
          `;

    actividades.forEach((actividad) => {
      const horaInicio = formatearHora(actividad.fecha_inicio);
      const horaFin = formatearHora(actividad.fecha_fin);
      const ubicacion =
        actividad.numero_aula && actividad.nombre_edificio
          ? `${actividad.numero_aula} - ${actividad.nombre_edificio}`
          : "Remoto";

      html += `
              <div class="activity-item">
                  <div class="activity-type">
                      <span class="group-badge">${actividad.grupo}</span>
                      <strong>${actividad.nombre_asignatura}</strong>
                  </div>
                  <div class="activity-details">
                      <div>${actividad.nombre_tipo_actividad}</div>
                      <div>👨‍🏫 ${actividad.nombre_profesor}</div>
                      <div class="activity-time">🕐 ${horaInicio} - ${horaFin}</div>
                      <div class="activity-location">📍 ${ubicacion}</div>
                  </div>
              </div>
            `;
    });

    html += `
                </td>
            </tr>
          `;
  });

  html += `
                  </tbody>
              </table>
          </div>
        `;

  return html;
}

function crearSelectGrupos(datos) {
  const grupos = document.getElementById("grupos");
  const gruposSet = new Set();

  // Si la API devuelve un array, usamos el primer elemento para extraer grupos
  const datosNormalizados = Array.isArray(datos) ? datos[2] : datos;

  // Extraer todos los grupos únicos de las actividades
  datosNormalizados.forEach((grupo) => {
    gruposSet.add(grupo);
  });

  // Limpiar opciones anteriores excepto la primera
  grupos.innerHTML = '<option value="">Todos los grupos</option>';

  // Crear opciones de grupos ordenadas
  const gruposArray = Array.from(gruposSet).sort();
  gruposArray.forEach((grupo) => {
    const option = document.createElement("option");
    option.value = grupo;
    option.textContent = grupo;

    // Seleccionar EN1 por defecto si existe
    if (grupo === "EN1") {
      option.selected = true;
    }

    grupos.appendChild(option);
  });

  // Añadir event listener para filtrar cuando cambie la selección
  grupos.removeEventListener("change", aplicarFiltros); // Remover listener previo
  grupos.addEventListener("change", aplicarFiltros);
}

function aplicarFiltros() {
  if (!datosOriginales) return;

  const grupoSeleccionado = document.getElementById("grupos").value;
  const datosFiltrados = filtrarPorGrupoYSemana(
    datosOriginales,
    grupoSeleccionado,
    semanaActual
  );

  const resultado = document.getElementById("resultado");
  const tablaHTML = crearTablaCalendario(datosFiltrados);
  resultado.innerHTML = tablaHTML;

  // Mostrar navegación de semana
  document.getElementById("weekNavigation").style.display = "flex";
  actualizarInfoSemana();
}

function cargarCronogramaXHR() {
  // const form = document.getElementById("filtros");
  // const formData = new FormData(form);

  // const payload = {
  //   programa: formData.get("programa"),
  //   sede: formData.get("sede"),
  //   jornada: formData.get("jornada"),
  // };

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "http://localhost:3000/cronograma", true);
  xhr.setRequestHeader("Content-Type", "application/json");

  const resultado = document.getElementById("resultado");
  resultado.innerHTML = '<div class="loading">🔄 Cargando cronograma...</div>';

  // Ocultar navegación de semana mientras carga
  document.getElementById("weekNavigation").style.display = "none";
  semanaActual = 0; // Resetear a semana actual

  xhr.onload = function () {
    if (xhr.status === 200) {
      try {
        const res = JSON.parse(xhr.responseText);

        if (res.data && res.data.length > 0) {
          // Guardar datos originales
          datosOriginales = res.data;

          // Crear select de grupos
          crearSelectGrupos(res.data);

          // Aplicar filtros iniciales
          aplicarFiltros();
        } else {
          resultado.innerHTML =
            '<div class="no-data">⚠️ No se encontraron datos para los filtros seleccionados</div>';
        }
      } catch (e) {
        console.error("Error al parsear JSON:", e);
        resultado.innerHTML =
          '<div class="no-data">❌ Error al procesar los datos</div>';
      }
    } else {
      resultado.innerHTML = `<div class="no-data" style="color:red;">❌ Error: ${xhr.status}</div>`;
    }
  };

  xhr.onerror = function () {
    resultado.innerHTML =
      '<div class="no-data" style="color:red;">❌ Error de red al cargar cronograma</div>';
  };

  // xhr.send(JSON.stringify(payload));
  xhr.send();
}

// Cargar datos de ejemplo al inicio
window.onload = function () {
  cargarCronogramaXHR();
};
