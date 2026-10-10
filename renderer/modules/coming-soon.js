// Pantalla para los módulos que se construyen en fases posteriores.
(function () {
  const { h, icon } = window.UI;

  const PLANS = {
    tenses: ['for / ago / since', 'Past Simple vs Present Perfect', 'will vs going to', 'would para rutinas del pasado', 'Frases con tu contexto: call center, importaciones, aduanas, agenda'],
    register: ['Frase de call center → elegís la versión corporativa', 'Más de 40 pares (apologize, please be advised, kindly confirm…)'],
    collocations: ['make / do / take / pay / gain + sustantivo', 'Más de 60 colocaciones'],
    vocab: ['Flashcards con repetición espaciada', 'Mazos: Negocios/agenda · Verbos de logro · Small talk'],
    progress: ['Gráfico de ejercicios por día', 'Porcentaje de acierto por módulo', 'Errores que todavía fallás, ordenados por frecuencia'],
    star: ['Cuatro cajas: Situation / Task / Action / Result', 'Aviso si usás «we» en Action, si falta un número, si es muy corto', 'Subraya tus errores de la tabla · guarda tus historias'],
    interview: ['Banco de preguntas: sobre mí, comportamiento, asistente ejecutivo', 'Cronómetro de 90 s y grabación de audio', 'Autoevaluación al terminar'],
    timezones: ['Escenarios al azar con jefe y colegas en otras ciudades', 'Costa Rica UTC−6 sin horario de verano · cambios de Europa y EE. UU.', 'Tabla de conversión completa · ciudades de Asia (cambio de fecha)'],
  };

  App.register('coming-soon', {
    placeholder: true,
    render(view, { moduleId }) {
      const m = App.meta(moduleId);
      view.append(h('div', { class: 'page' },
        h('div', { class: 'empty' },
          h('div', { class: 'big-icon' }, icon(m.icon)),
          h('h1', null, m.title),
          h('p', { class: 'muted' }, `Este módulo llega en la Fase ${m.phase}. Esto es lo que va a traer:`),
          h('ul', null, (PLANS[moduleId] || []).map((p) => h('li', null, p))),
          h('div', { style: { marginTop: '24px' } },
            h('button', { class: 'btn', onclick: () => App.go('error-killer') }, 'Mientras tanto: Error Killer')))));
    },
  });
})();
