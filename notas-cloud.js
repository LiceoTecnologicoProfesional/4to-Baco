/**
 * Cliente de notas en Google Sheets (JSONP).
 * Requiere window.NOTAS_CONFIG.WEB_APP_URL en config.js
 */
(function (global) {
  function getUrl() {
    var cfg = global.NOTAS_CONFIG || {};
    return (cfg.WEB_APP_URL || "").trim();
  }

  function estaConfigurado() {
    return getUrl().indexOf("https://script.google.com/") === 0;
  }

  function jsonp(params) {
    return new Promise(function (resolve, reject) {
      var base = getUrl();
      if (!base) {
        reject(new Error("Falta la URL de Google en config.js"));
        return;
      }

      var cb = "notas_cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      var q = [];
      Object.keys(params).forEach(function (k) {
        if (params[k] == null) return;
        q.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
      });
      q.push("callback=" + encodeURIComponent(cb));

      var script = document.createElement("script");
      var done = false;

      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("No hubo respuesta de Google Sheets. Revisa que la app web sea pública (Cualquier persona) y se ejecute como tú."));
      }, 25000);

      function cleanup() {
        clearTimeout(timer);
        try { delete global[cb]; } catch (e) { global[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      global[cb] = function (data) {
        if (done) return;
        done = true;
        cleanup();
        resolve(data);
      };

      // Google redirige a otra dirección antes de responder. En el celular
      // ese salto dispara "error" aunque después sí llegue la nota.
      script.onerror = function () {};

      script.src = base + (base.indexOf("?") >= 0 ? "&" : "?") + q.join("&");
      document.head.appendChild(script);
    });
  }

  function exigirOk(res, fallback) {
    if (!res || !res.ok) throw new Error((res && res.error) || fallback);
    return res;
  }

  global.NotasCloud = {
    estaConfigurado: estaConfigurado,
    asegurar: function () {
      return jsonp({ action: "asegurar" }).then(function (res) {
        return exigirOk(res, "No se pudo preparar la hoja de preguntas");
      });
    },
    guardar: function (registro) {
      return jsonp({
        action: "guardar",
        nombre: registro.nombre,
        materia: registro.materia,
        respuestas: registro.respuestas,
        fecha: registro.fecha
      }).then(function (res) {
        return exigirOk(res, "Error al guardar");
      });
    },
    listar: function () {
      return jsonp({ action: "list" }).then(function (res) {
        exigirOk(res, "Error al listar");
        return res.resumen || [];
      });
    },
    detalle: function () {
      return jsonp({ action: "detalle" }).then(function (res) {
        exigirOk(res, "No se pudieron leer las notas");
        return res.alumnos || [];
      });
    },
    borrarTodo: function (clave) {
      return jsonp({
        action: "borrar",
        clave: clave || ((global.NOTAS_CONFIG && global.NOTAS_CONFIG.CLAVE_DOCENTE) || "BORRAR")
      }).then(function (res) {
        return exigirOk(res, "Error al borrar");
      });
    }
  };
})(window);
