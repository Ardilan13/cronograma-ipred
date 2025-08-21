const BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://cronograma-ipred.onrender.com";
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

function filtrarPorGrupoYSemana(datos, gruposSeleccionados, semanaOffset) {
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
            // Filtrar por grupo (si hay selección, aplica; si no, muestra todos)
            const pasaFiltroGrupo =
              gruposSeleccionados.length === 0 ||
              gruposSeleccionados.includes(actividad.grupo);

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
    // 🔹 Ordenamos las actividades por hora de inicio
    const actividades = actividadesPorFecha[fecha].sort((a, b) => {
      return new Date(a.fecha_inicio) - new Date(b.fecha_inicio);
    });

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
            <span class="group-badge" 
              style="background-color:${getColorForGroup(actividad.grupo)}">
              ${actividad.grupo}
            </span>
            <strong>${actividad.nombre_asignatura}</strong>
          </div>
          <div class="activity-details">
            <div>📄 ${actividad.nombre_tipo_actividad}</div>
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

// Asigna un color único a cada grupo
const coloresGrupos = {};
const paletaColores = [
  "#1E90FF",
  "#FF6347",
  "#32CD32",
  "#FF69B4",
  "#FFA500",
  "#8A2BE2",
  "#00CED1",
  "#FF4500",
  "#2E8B57",
  "#FF1493",
  "#6495ED",
  "#FFD700",
  "#DC143C",
  "#20B2AA",
  "#9370DB",
];

function getColorForGroup(grupo) {
  // Si ya asignamos un color a este grupo, usamos el mismo
  if (coloresGrupos[grupo]) return coloresGrupos[grupo];

  // Si no, elegimos un color de la paleta
  const index = Object.keys(coloresGrupos).length % paletaColores.length;
  const color = paletaColores[index];

  coloresGrupos[grupo] = color;
  return color;
}

function crearMultiSelectGrupos(datos) {
  const contenedor = document.getElementById("grupos-container");
  contenedor.innerHTML = "";
  const selectedBox = document.getElementById("selected");
  const dropdown = document.getElementById("dropdown");
  const searchBox = document.getElementById("searchBox");

  // Obtener grupos únicos
  const datosNormalizados = Array.isArray(datos) ? datos[2] : datos;
  const gruposUnicos = [...new Set(datosNormalizados)].sort();

  const gruposSeleccionadosPorDefecto = ["EN1", "DN1"];
  const seleccionadosInicialmente = [];

  // Crear checkboxes dinámicamente
  gruposUnicos.forEach((grupo) => {
    const optionDiv = document.createElement("div");
    optionDiv.classList.add("grupo-option");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = grupo;
    checkbox.id = `grupo-${grupo}`;

    // Seleccionar EN1 y DN1 por defecto si existen
    if (gruposSeleccionadosPorDefecto.includes(grupo)) {
      checkbox.checked = true;
      seleccionadosInicialmente.push(grupo);
    }

    const label = document.createElement("label");
    label.setAttribute("for", `grupo-${grupo}`);
    label.textContent = grupo;

    optionDiv.appendChild(checkbox);
    optionDiv.appendChild(label);
    contenedor.appendChild(optionDiv);
  });

  // Mostrar/ocultar dropdown al hacer clic en el selectedBox
  selectedBox.onclick = (e) => {
    e.stopPropagation(); // Evita que se dispare el evento global
    dropdown.classList.toggle("hidden");
    searchBox.focus();
  };

  // Ocultar el dropdown si se hace clic fuera
  document.addEventListener("click", (e) => {
    if (
      !dropdown.contains(e.target) && // No está haciendo clic dentro del dropdown
      !selectedBox.contains(e.target) // No está haciendo clic en el botón que abre
    ) {
      dropdown.classList.add("hidden");
    }
  });

  // Filtrar grupos mientras escribes
  searchBox.addEventListener("input", () => {
    const filtro = searchBox.value.toLowerCase();
    document.querySelectorAll(".grupo-option").forEach((option) => {
      const texto = option.textContent.toLowerCase();
      option.style.display = texto.includes(filtro) ? "flex" : "none";
    });
  });

  // Actualizar etiqueta y aplicar filtros cuando se seleccionan grupos
  contenedor.addEventListener("change", () => {
    const seleccionados = Array.from(
      contenedor.querySelectorAll("input[type='checkbox']:checked")
    ).map((input) => input.value);

    selectedBox.textContent =
      seleccionados.length > 0
        ? seleccionados.join(", ")
        : "Seleccionar grupo(s)";

    aplicarFiltros();
  });

  // Mostrar seleccionados por defecto si hay
  if (seleccionadosInicialmente.length > 0) {
    selectedBox.textContent = seleccionadosInicialmente.join(", ");
  } else {
    selectedBox.textContent = "Seleccionar grupo(s)";
  }

  // Aplicar filtros iniciales con grupos por defecto si hay
  aplicarFiltros();
}

// Modificamos aplicarFiltros() para leer de checkboxes
function aplicarFiltros() {
  if (!datosOriginales) return;

  const contenedor = document.getElementById("grupos-container");
  const gruposSeleccionados = Array.from(
    contenedor.querySelectorAll("input[type='checkbox']:checked")
  ).map((opt) => opt.value);

  const datosFiltrados = filtrarPorGrupoYSemana(
    datosOriginales,
    gruposSeleccionados,
    semanaActual
  );

  const resultado = document.getElementById("resultado");
  const tablaHTML = crearTablaCalendario(datosFiltrados);
  resultado.innerHTML = tablaHTML;

  // Mostrar navegación de semana
  document.getElementById("weekNavigation").style.display = "flex";
  actualizarInfoSemana();
}

let gruposSeleccionados = [];

// Manejar envío de formulario
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("filtros");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    cargarCronogramaXHR();
  });
});

function cargarCronogramaXHR() {
  const form = document.getElementById("filtros");
  const formData = new FormData(form);

  const payload = {
    programa: formData.get("programa"),
    sede: formData.get("sede"),
    jornada: formData.get("jornada"),
  };

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${BASE_URL}/cronograma`, true);
  xhr.setRequestHeader("Content-Type", "application/json");

  const resultado = document.getElementById("resultado");
  resultado.innerHTML = '<div class="loading">🔄 Cargando cronograma...</div>';
  document.getElementById("weekNavigation").style.display = "none";
  document.getElementById("gruposWrapper").style.display = "none";

  semanaActual = 0;

  xhr.onload = function () {
    if (xhr.status === 200) {
      try {
        const res = JSON.parse(xhr.responseText);

        if (res.data && res.data.length > 0) {
          datosOriginales = res.data;

          // Crear multi-select de grupos
          crearMultiSelectGrupos(res.data);

          // Mostrar contenedor de grupos
          document.getElementById("gruposWrapper").style.display = "flex";

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

  xhr.send(JSON.stringify(payload));
}

// Cargar datos de ejemplo al inicio
window.onload = function () {
  cargarCronogramaXHR();
};
