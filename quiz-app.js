(function (global) {
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function iniciar(cfg) {
    var total = cfg.preguntas.length;
    var app = document.getElementById("app");
    var respuestas = [];
    var paso = 0;
    var modo = "quiz";
    var nombre = "";
    var fecha = "";
    var guardado = null;
    var enviando = false;

    document.documentElement.style.setProperty("--accent", cfg.accent);
    document.documentElement.style.setProperty("--accent-soft", cfg.accentSoft);
    document.documentElement.style.setProperty("--bg", cfg.fondo);

    function leerLocal() {
      try {
        return JSON.parse(localStorage.getItem(cfg.storageKey) || "null");
      } catch (e) {
        return null;
      }
    }

    function escribirLocal(data) {
      localStorage.setItem(cfg.storageKey, JSON.stringify(data));
    }

    function calificar() {
      var aciertos = 0;
      var detalle = cfg.preguntas.map(function (p, i) {
        var marcada = respuestas[i] || "";
        var bien = marcada === p.correcta;
        if (bien) aciertos++;
        return { n: i + 1, bien: bien, tema: p.tema };
      });
      return {
        aciertos: aciertos,
        total: total,
        puntos: aciertos + "/" + total,
        nota: Math.round((aciertos / total) * 100),
        detalle: detalle
      };
    }

    function render() {
      app.textContent = "";
      var top = el("div", "top");
      top.appendChild(el("div", "badge", cfg.badge));
      var der = el("div", null);
      der.style.display = "flex";
      der.style.alignItems = "center";
      der.style.gap = "0.5rem";
      if (modo === "quiz") {
        der.appendChild(el("div", "paso", paso === 0 ? "Inicio" : paso + " / " + total));
      }
      if (typeof cfg.alSalir === "function") {
        var salir = el("button", "btn-back", "Volver");
        salir.type = "button";
        salir.style.minHeight = "36px";
        salir.style.padding = "0.35rem 0.75rem";
        salir.addEventListener("click", cfg.alSalir);
        der.appendChild(salir);
      }
      top.appendChild(der);
      app.appendChild(top);

      if (modo === "quiz") {
        var barra = el("div", "barra");
        var fill = document.createElement("i");
        fill.style.width = (paso / total) * 100 + "%";
        barra.appendChild(fill);
        app.appendChild(barra);
        app.appendChild(paso === 0 ? vistaNombre() : vistaPregunta(paso - 1));
        app.appendChild(vistaNav());
      } else {
        app.appendChild(modo === "hecha" ? vistaHecha() : vistaResultado());
      }
      window.scrollTo(0, 0);
    }

    function vistaNombre() {
      var box = el("section", "tarjeta");
      box.appendChild(el("h1", null, cfg.titulo));
      box.appendChild(el("p", "lead", "Escribe tu nombre y responde las " + total + " preguntas. Solo puedes hacer esta prueba una vez en este celular."));
      var lab = el("label", "campo", "Nombre del alumno");
      lab.setAttribute("for", "nombreAlumno");
      var input = document.createElement("input");
      input.type = "text";
      input.id = "nombreAlumno";
      input.maxLength = 80;
      input.autocomplete = "name";
      input.placeholder = "Nombre y apellido";
      input.value = nombre;
      input.addEventListener("input", function () {
        nombre = input.value;
        var aviso = document.getElementById("aviso");
        if (aviso) aviso.textContent = "";
      });
      box.appendChild(lab);
      box.appendChild(input);
      box.appendChild(el("p", "aviso", ""));
      box.lastChild.id = "aviso";
      var estado = el("p", "estado", "Comprobando Google Sheets…");
      estado.id = "estadoNube";
      box.appendChild(estado);
      setTimeout(function () { input.focus(); }, 50);
      return box;
    }

    function vistaPregunta(i) {
      var p = cfg.preguntas[i];
      var box = el("section", "tarjeta");
      box.appendChild(el("p", "badge", "Pregunta " + (i + 1) + " · " + p.tema));
      box.appendChild(el("h2", "pregunta", p.texto));
      if (p.pista) box.appendChild(el("p", "pista", p.pista));
      var caja = el("div", "opciones");
      p.opciones.forEach(function (op) {
        var b = el("button", "opcion" + (respuestas[i] === op.id ? " sel" : ""));
        b.type = "button";
        b.appendChild(el("span", "letra", op.id.toUpperCase()));
        b.appendChild(el("span", null, op.texto));
        b.addEventListener("click", function () {
          respuestas[i] = op.id;
          render();
        });
        caja.appendChild(b);
      });
      box.appendChild(caja);
      var aviso = el("p", "aviso", "");
      aviso.id = "aviso";
      box.appendChild(aviso);
      return box;
    }

    function vistaNav() {
      var nav = el("div", "nav");
      if (paso > 0) {
        var atras = el("button", "btn-back", "Atrás");
        atras.type = "button";
        atras.addEventListener("click", function () {
          paso -= 1;
          render();
        });
        nav.appendChild(atras);
      }
      var texto = paso === 0 ? "Comenzar" : (paso === total ? "Enviar prueba" : "Siguiente");
      var next = el("button", "btn-main", texto);
      next.type = "button";
      next.addEventListener("click", function () {
        if (paso === 0) {
          nombre = nombre.trim().replace(/\s+/g, " ");
          if (nombre.length < 3) {
            document.getElementById("aviso").textContent = "Escribe tu nombre completo.";
            return;
          }
          paso = 1;
          render();
          return;
        }
        if (!respuestas[paso - 1]) {
          document.getElementById("aviso").textContent = "Elige una opción para continuar.";
          return;
        }
        if (paso < total) {
          paso += 1;
          render();
          return;
        }
        enviar();
      });
      nav.appendChild(next);
      return nav;
    }

    function bloquePunteo(notaObj) {
      var box = el("section", "tarjeta");
      box.appendChild(el("p", "badge", cfg.badge));
      box.appendChild(el("h1", null, nombre));
      box.appendChild(el("p", "punteo", notaObj.puntos));
      box.appendChild(el("p", "nota", "Nota: " + notaObj.nota));
      return box;
    }

    function listaDetalle(notaObj) {
      var ul = el("ul", "lista");
      notaObj.detalle.forEach(function (d) {
        var li = el("li", d.bien ? "bien" : "mal");
        li.appendChild(el("span", null, d.n + ". " + d.tema));
        li.appendChild(el("strong", null, d.bien ? "Bien" : "Mal"));
        ul.appendChild(li);
      });
      return ul;
    }

    function vistaHecha() {
      var notaObj = {
        puntos: guardado.puntos,
        nota: guardado.nota,
        detalle: guardado.detalle || calificar().detalle
      };
      var wrap = el("div", "centro");
      var box = bloquePunteo(notaObj);
      box.appendChild(el("p", "lead", "Esta prueba ya fue hecha. No puedes repetirla en este celular."));
      if (guardado.fecha) box.appendChild(el("p", "pista", "Fecha: " + guardado.fecha));
      if (notaObj.detalle) box.appendChild(listaDetalle(notaObj));
      wrap.appendChild(box);
      return wrap;
    }

    function vistaResultado() {
      var notaObj = calificar();
      var wrap = el("div", "centro");
      var box = bloquePunteo(notaObj);
      var msg = el("p", "lead", enviando
        ? "Guardando tu prueba en Google Sheets…"
        : "Este intento ya quedó cerrado en este celular. Pulsa reintentar si aún no aparece en la hoja.");
      msg.id = "estadoEnvio";
      box.appendChild(msg);
      var aviso = el("p", "aviso", "");
      aviso.id = "aviso";
      box.appendChild(aviso);
      box.appendChild(listaDetalle(notaObj));
      if (!enviando && !(guardado && guardado.estado === "guardada")) {
        var retry = el("button", "btn-main", "Reintentar guardado");
        retry.type = "button";
        retry.style.marginTop = "1rem";
        retry.style.width = "100%";
        retry.addEventListener("click", guardarNube);
        box.appendChild(retry);
      }
      wrap.appendChild(box);
      return wrap;
    }

    function enviar() {
      fecha = new Date().toLocaleString("es-GT");
      var notaObj = calificar();
      guardado = {
        estado: "pendiente",
        nombre: nombre,
        respuestas: respuestas.slice(),
        puntos: notaObj.puntos,
        nota: notaObj.nota,
        detalle: notaObj.detalle,
        fecha: fecha,
        ciclo: ciclo
      };
      escribirLocal(guardado);
      modo = "pendiente";
      enviando = true;
      render();
      guardarNube();
    }

    var guardando = false;

    function guardarNube() {
      if (guardando) return;
      if (!global.NotasCloud || !NotasCloud.estaConfigurado()) {
        enviando = false;
        render();
        var aviso = document.getElementById("aviso");
        if (aviso) aviso.textContent = "Falta conectar Google Sheets en config.js. Tu punteo quedó en este celular.";
        return;
      }
      enviando = true;
      guardando = true;
      var estado = document.getElementById("estadoEnvio");
      if (estado) estado.textContent = "Guardando tu prueba en Google Sheets…";
      var aviso = document.getElementById("aviso");
      if (aviso) aviso.textContent = "";

      NotasCloud.guardar({
        nombre: nombre,
        materia: cfg.materia,
        respuestas: respuestas.join(","),
        fecha: fecha
      }).then(function (res) {
        guardado.estado = "guardada";
        guardado.puntos = res.puntos;
        guardado.nota = res.nota;
        guardado.fecha = res.fecha || fecha;
        escribirLocal(guardado);
        guardando = false;
        enviando = false;
        modo = "hecha";
        render();
      }).catch(function (err) {
        guardando = false;
        enviando = false;
        render();
        var nodo = document.getElementById("aviso");
        if (nodo) nodo.textContent = err.message || "No se pudo guardar. Tu intento ya quedó cerrado en este celular.";
      });
    }

    var ciclo = null;
    var listo = false;

    function mostrarEstado(texto) {
      var nodo = document.getElementById("estadoNube");
      if (nodo) nodo.textContent = texto;
    }

    function aplicarIntento(local) {
      nombre = local.nombre || "";
      respuestas = local.respuestas || [];
      fecha = local.fecha || "";
      guardado = local;
      modo = local.estado === "guardada" ? "hecha" : "pendiente";
    }

    function pintar(conectado) {
      render();
      if (modo === "pendiente") guardarNube();
      if (!global.NotasCloud || !NotasCloud.estaConfigurado()) {
        mostrarEstado("Falta configurar config.js");
      } else if (!conectado) {
        mostrarEstado("Sin conexión con Google Sheets. Al terminar se intentará guardar de nuevo.");
      } else {
        mostrarEstado("Conectado a Google Sheets");
      }
    }

    function decidir(cicloServidor, conectado) {
      if (cicloServidor != null) ciclo = Number(cicloServidor);
      var local = leerLocal();
      var reiniciado = local && local.estado && cicloServidor != null && (
        (local.ciclo != null && Number(local.ciclo) !== Number(cicloServidor)) ||
        (local.ciclo == null && Number(cicloServidor) > 1)
      );
      if (reiniciado) {
        localStorage.removeItem(cfg.storageKey);
        local = null;
        nombre = "";
        respuestas = [];
        fecha = "";
        guardado = null;
        modo = "quiz";
        paso = 0;
      } else if (!listo && local && local.estado) {
        aplicarIntento(local);
      }
      if (!listo || reiniciado) {
        listo = true;
        pintar(conectado);
      } else {
        mostrarEstado(conectado ? "Conectado a Google Sheets" : "Sin conexión con Google Sheets. Al terminar se intentará guardar de nuevo.");
      }
    }

    var localInicial = leerLocal();
    if (!localInicial || !localInicial.estado || !global.NotasCloud || !NotasCloud.estaConfigurado()) {
      if (localInicial && localInicial.estado) aplicarIntento(localInicial);
      listo = true;
      pintar(false);
    }

    if (global.NotasCloud && NotasCloud.estaConfigurado()) {
      NotasCloud.asegurar().then(function (res) {
        decidir(res.ciclo != null ? res.ciclo : null, true);
      }).catch(function () {
        if (!listo) decidir(null, false);
      });
    }
  }

  global.QuizApp = { iniciar: iniciar };
})(window);
