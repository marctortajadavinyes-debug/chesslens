/**
 * terms.tsx
 *
 * Public Terms of Use page — /terms
 * Available in Catalan, Spanish and English.
 * Reads the app language from localStorage (same key as the rest of FotoChess).
 * No login required. No Drive dependency. Works on direct URL reload.
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

type Lang = "ca" | "es" | "en";

const SETTINGS_KEY = "chesslens_user_settings_v1";

function readStoredLang(): Lang {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return "ca";
    const parsed = JSON.parse(raw) as { appLanguage?: string };
    const l = parsed?.appLanguage;
    if (l === "ca" || l === "es" || l === "en") return l;
  } catch {
    // ignore
  }
  return "ca";
}

// ─── Content types ────────────────────────────────────────────────────────────

interface TermsContent {
  title: string;
  lastUpdated: string;
  backLink: string;
  ariaLabel: string;
  intro: React.ReactNode;
  sections: { heading: string; body: React.ReactNode }[];
}

const CONTACT_EMAIL = "chessproapp.mvp@gmail.com";

function EmailLink() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      className="underline hover:text-foreground transition-colors"
    >
      {CONTACT_EMAIL}
    </a>
  );
}

// ─── Lang selector labels ─────────────────────────────────────────────────────

const LANG_LABELS: Record<Lang, string> = {
  ca: "Català",
  es: "Español",
  en: "English",
};

// ─── Content — Catalan ────────────────────────────────────────────────────────

const CONTENT_CA: TermsContent = {
  title: "Condicions d'ús de FotoChess",
  lastUpdated: "Última actualització: 29 de juliol de 2026",
  backLink: "Tornar a FotoChess",
  ariaLabel: "Tornar a FotoChess",
  intro: (
    <>
      <p>Aquestes Condicions d'ús regulen l'accés i la utilització de FotoChess.</p>
      <p>En utilitzar FotoChess, l'usuari es compromet a fer-ne un ús responsable, lícit i conforme a aquestes condicions.</p>
    </>
  ),
  sections: [
    {
      heading: "1. Titular i dades de contacte",
      body: (
        <>
          <p>FotoChess és un servei creat i gestionat per:</p>
          <ul>
            <li><strong>Responsable:</strong> Marc Tortajada Vinyes, creador i responsable de FotoChess</li>
            <li><strong>País:</strong> Espanya</li>
            <li><strong>Correu de contacte:</strong> <EmailLink /></li>
          </ul>
          <p>L'usuari pot utilitzar aquest correu per comunicar incidències, consultes relacionades amb el servei o possibles usos indeguts.</p>
        </>
      ),
    },
    {
      heading: "2. Objecte del servei",
      body: (
        <>
          <p>FotoChess permet, entre altres funcions:</p>
          <ul>
            <li>digitalitzar planelles d'escacs a partir d'imatges aportades per l'usuari;</li>
            <li>generar un PGN provisional o final;</li>
            <li>revisar i corregir jugades;</li>
            <li>visualitzar la partida en un tauler;</li>
            <li>copiar, descarregar i exportar el PGN;</li>
            <li>guardar i consultar partides al Google Drive del mateix usuari;</li>
            <li>analitzar posicions i partides d'escacs;</li>
            <li>gestionar una biblioteca personal de partides dins del compte de Google Drive de l'usuari.</li>
          </ul>
          <p>Les funcions disponibles poden evolucionar, modificar-se o ampliar-se amb el temps.</p>
        </>
      ),
    },
    {
      heading: "3. Ús personal i autoritzat",
      body: (
        <>
          <p>FotoChess està destinat principalment a la digitalització, consulta, estudi i anàlisi de partides d'escacs.</p>
          <p>L'usuari pot utilitzar el servei per a finalitats personals, educatives, esportives, formatives o professionals lícites, sempre que:</p>
          <ul>
            <li>respecti aquestes condicions;</li>
            <li>no perjudiqui FotoChess ni altres usuaris;</li>
            <li>no utilitzi el servei per a activitats il·lícites;</li>
            <li>no intenti eludir les mesures tècniques o de seguretat;</li>
            <li>no faci un ús automatitzat o massiu sense autorització prèvia.</li>
          </ul>
          <p>L'ús de FotoChess no concedeix a l'usuari cap dret de propietat sobre el servei, el seu disseny, el seu codi, els seus sistemes interns o la seva identitat visual.</p>
        </>
      ),
    },
    {
      heading: "4. Contingut aportat per l'usuari",
      body: (
        <>
          <p>L'usuari conserva els drets que li corresponguin sobre:</p>
          <ul>
            <li>les imatges de les planelles que aporta;</li>
            <li>les dades de les partides;</li>
            <li>els PGN generats a partir de les seves planelles;</li>
            <li>les correccions introduïdes;</li>
            <li>els arxius que decideixi guardar al seu Google Drive.</li>
          </ul>
          <p>L'usuari autoritza FotoChess únicament a tractar temporalment aquest contingut en la mesura necessària per prestar les funcions que sol·licita.</p>
          <p>FotoChess no adquireix la propietat de les planelles, les partides o els PGN de l'usuari.</p>
          <p>L'usuari no ha de pujar imatges:</p>
          <ul>
            <li>que no tingui dret a utilitzar;</li>
            <li>obtingudes de manera il·lícita;</li>
            <li>que continguin informació personal innecessària;</li>
            <li>que vulnerin drets de tercers;</li>
            <li>que continguin programari maliciós, contingut manipulat amb finalitats abusives o elements destinats a atacar el servei.</li>
          </ul>
        </>
      ),
    },
    {
      heading: "5. Exactitud del PGN i responsabilitat de revisió",
      body: (
        <>
          <p>FotoChess està dissenyat per obtenir un PGN fiable a partir d'una planella manuscrita, però la lectura automàtica pot contenir errors, omissions o interpretacions incorrectes.</p>
          <p>Quan FotoChess detecta una jugada dubtosa, pot demanar la intervenció de l'usuari per revisar-la.</p>
          <p>L'usuari és responsable de:</p>
          <ul>
            <li>revisar el PGN abans de considerar-lo definitiu;</li>
            <li>comprovar els noms, dates, resultats i altres metadades;</li>
            <li>corregir les jugades que no coincideixin amb la planella;</li>
            <li>verificar el fitxer abans d'utilitzar-lo en una base de dades, torneig, publicació o servei extern.</li>
          </ul>
          <p>FotoChess no garanteix que qualsevol imatge, cal·ligrafia, format o estat físic de la planella pugui ser interpretat sense errors.</p>
        </>
      ),
    },
    {
      heading: "6. Anàlisi d'escacs",
      body: (
        <>
          <p>Les avaluacions, variants i suggeriments mostrats durant l'anàlisi tenen una finalitat informativa i formativa.</p>
          <p>L'usuari ha de tenir en compte que:</p>
          <ul>
            <li>l'avaluació depèn de la posició, la profunditat i els recursos de càlcul disponibles;</li>
            <li>una anàlisi pot variar si es calcula amb altres paràmetres;</li>
            <li>les línies mostrades no constitueixen assessorament professional;</li>
            <li>FotoChess no garanteix que una variant sigui l'única ni la millor explicació possible d'una posició.</li>
          </ul>
        </>
      ),
    },
    {
      heading: "7. Google Drive i serveis externs",
      body: (
        <>
          <p>La connexió amb Google Drive és opcional i només s'activa quan l'usuari ho sol·licita.</p>
          <p>Els fitxers es guarden al compte de Google Drive del mateix usuari, dins la carpeta «Chess Games».</p>
          <p>L'usuari és responsable de:</p>
          <ul>
            <li>mantenir la seguretat del seu compte de Google;</li>
            <li>revisar els permisos concedits;</li>
            <li>conservar o eliminar els fitxers;</li>
            <li>revocar l'accés de FotoChess quan ho consideri convenient.</li>
          </ul>
          <p>L'ús de Google Drive, Chess.com, Lichess.org, ChessBase o altres serveis externs també està subjecte a les condicions pròpies d'aquests serveis.</p>
          <p>FotoChess no controla la disponibilitat, les modificacions, les restriccions o les decisions adoptades per aquests tercers.</p>
          <p>FotoChess no està afiliada, patrocinada ni avalada per Chess.com, Lichess.org o ChessBase.</p>
        </>
      ),
    },
    {
      heading: "8. Usos prohibits",
      body: (
        <>
          <p>Queda prohibit utilitzar FotoChess per:</p>
          <ul>
            <li>cometre activitats il·lícites o facilitar-les;</li>
            <li>introduir, transmetre o distribuir programari maliciós;</li>
            <li>interrompre, degradar o impedir el funcionament normal del servei;</li>
            <li>sobrecarregar deliberadament els servidors;</li>
            <li>executar atacs de denegació de servei;</li>
            <li>enviar un volum desproporcionat de peticions;</li>
            <li>crear processos automatitzats que consumeixin recursos de manera abusiva;</li>
            <li>eludir límits, controls, bloquejos o mesures de seguretat;</li>
            <li>accedir a dades, partides, sessions o recursos d'altres usuaris;</li>
            <li>suplantar altres persones;</li>
            <li>manipular peticions o identificadors amb l'objectiu d'obtenir accés no autoritzat;</li>
            <li>explotar vulnerabilitats;</li>
            <li>fer proves de penetració, escanejos de seguretat o proves de càrrega sense autorització prèvia i escrita;</li>
            <li>utilitzar el servei per crear un producte competidor mitjançant extracció automatitzada o abusiva d'informació no pública;</li>
            <li>revendre, subarrendar o proporcionar accés comercial massiu al servei sense autorització.</li>
          </ul>
        </>
      ),
    },
    {
      heading: "9. Automatització, robots i accés massiu",
      body: (
        <>
          <p>FotoChess no ofereix actualment una API pública per a l'ús automatitzat del servei.</p>
          <p>Sense autorització prèvia i escrita, no es permet:</p>
          <ul>
            <li>operar FotoChess mitjançant bots o scripts;</li>
            <li>enviar partides de forma massiva;</li>
            <li>automatitzar la càrrega d'imatges;</li>
            <li>automatitzar consultes d'anàlisi;</li>
            <li>realitzar scraping sistemàtic;</li>
            <li>crear múltiples processos simultanis per evitar limitacions;</li>
            <li>utilitzar el servei com a infraestructura de processament per a una altra aplicació.</li>
          </ul>
          <p>Les eines d'accessibilitat, les funcions normals del navegador i els usos individuals raonables no es consideren automatització abusiva.</p>
        </>
      ),
    },
    {
      heading: "10. Protecció del funcionament intern de FotoChess",
      body: (
        <>
          <p>El funcionament intern no públic de FotoChess, inclosos els seus sistemes, regles, configuracions, credencials, claus, instruccions internes, mesures de seguretat i processos de tractament, forma part dels actius protegits del servei.</p>
          <p>Queda prohibit intentar obtenir, reconstruir, descobrir o explotar informació interna no pública mitjançant:</p>
          <ul>
            <li>accés no autoritzat;</li>
            <li>explotació de vulnerabilitats;</li>
            <li>manipulació de peticions;</li>
            <li>elusió de controls;</li>
            <li>extracció automatitzada;</li>
            <li>ús abusiu del servei;</li>
            <li>obtenció o intent d'obtenció de credencials, claus o secrets;</li>
            <li>interferència amb les comunicacions entre el navegador i el servidor;</li>
            <li>reproducció sistemàtica destinada a copiar el funcionament no públic del servei.</li>
          </ul>
          <p>Aquesta prohibició no limita els drets que la normativa imperativa reconegui als usuaris legítims, inclosos els actes necessaris per a la interoperabilitat o altres actuacions expressament permeses per la llei.</p>
          <p>Les persones que detectin una possible vulnerabilitat han de comunicar-la de manera responsable a:</p>
          <p><EmailLink /></p>
          <p>No s'ha d'explotar públicament ni utilitzar per accedir a dades o interrompre el servei.</p>
        </>
      ),
    },
    {
      heading: "11. Propietat intel·lectual",
      body: (
        <>
          <p>El nom FotoChess, la identitat visual, el disseny de la interfície, els textos originals, l'organització del servei i el codi propi estan protegits per la normativa aplicable.</p>
          <p>No es permet, sense autorització:</p>
          <ul>
            <li>copiar o redistribuir substancialment la interfície;</li>
            <li>utilitzar la marca FotoChess de manera que generi confusió;</li>
            <li>presentar un producte de tercers com si estigués afiliat a FotoChess;</li>
            <li>reproduir els elements propis del servei per crear una còpia confusament similar;</li>
            <li>eliminar avisos de propietat o atribució.</li>
          </ul>
          <p>Els components de tercers i de codi obert incorporats al servei continuen subjectes a les seves llicències respectives.</p>
          <p>Aquestes condicions no atribueixen a FotoChess drets sobre les partides o planelles aportades per l'usuari.</p>
        </>
      ),
    },
    {
      heading: "12. Disponibilitat, manteniment i fase beta",
      body: (
        <>
          <p>FotoChess pot trobar-se en fase beta, de prova o d'evolució activa.</p>
          <p>El servei pot experimentar:</p>
          <ul>
            <li>interrupcions temporals;</li>
            <li>manteniment;</li>
            <li>canvis de funcionalitat;</li>
            <li>limitacions de capacitat;</li>
            <li>temps d'espera;</li>
            <li>incompatibilitats puntuals;</li>
            <li>errors no detectats;</li>
            <li>modificacions derivades de serveis de tercers.</li>
          </ul>
          <p>FotoChess procurarà mantenir el servei disponible i estable, però no garanteix una disponibilitat permanent o ininterrompuda.</p>
          <p>Es poden establir límits raonables d'ús per protegir l'estabilitat, la seguretat i l'accés equitatiu dels usuaris.</p>
        </>
      ),
    },
    {
      heading: "13. Suspensió o limitació de l'accés",
      body: (
        <>
          <p>FotoChess pot limitar o suspendre temporalment l'accés quan existeixin indicis raonables de:</p>
          <ul>
            <li>atac o intent d'atac;</li>
            <li>ús automatitzat abusiu;</li>
            <li>sobrecàrrega deliberada;</li>
            <li>accés no autoritzat;</li>
            <li>vulneració greu d'aquestes condicions;</li>
            <li>risc per a la seguretat, les dades o la continuïtat del servei;</li>
            <li>obligació legal o requeriment d'una autoritat competent.</li>
          </ul>
          <p>Quan sigui possible i proporcionat, s'intentarà que la mesura afecti només l'activitat o l'accés problemàtic.</p>
          <p>FotoChess pot conservar la informació tècnica estrictament necessària per investigar l'incident, aplicar mesures de seguretat o atendre responsabilitats legals.</p>
        </>
      ),
    },
    {
      heading: "14. Responsabilitat",
      body: (
        <>
          <p>FotoChess es presta amb la diligència raonablement exigible segons les característiques del servei.</p>
          <p>Dins dels límits permesos per la normativa aplicable, FotoChess no serà responsable dels perjudicis derivats exclusivament de:</p>
          <ul>
            <li>l'ús d'un PGN que l'usuari no hagi revisat;</li>
            <li>dades incorrectes introduïdes o confirmades per l'usuari;</li>
            <li>la mala qualitat o il·legibilitat d'una imatge;</li>
            <li>la pèrdua de fitxers eliminats pel mateix usuari del seu Google Drive;</li>
            <li>decisions preses exclusivament a partir de l'anàlisi;</li>
            <li>indisponibilitat o canvis de serveis externs;</li>
            <li>ús fraudulent del dispositiu o del compte de Google de l'usuari;</li>
            <li>usos contraris a aquestes condicions.</li>
          </ul>
          <p>Res d'aquest apartat exclou o limita els drets obligatoris dels consumidors ni la responsabilitat que no pugui ser legalment exclosa.</p>
        </>
      ),
    },
    {
      heading: "15. Privacitat",
      body: (
        <>
          <p>El tractament de dades personals i de les imatges aportades es descriu a la Política de privacitat de FotoChess, accessible des de la pàgina principal.</p>
          <p>La Política de privacitat forma part de la informació aplicable a l'ús del servei.</p>
        </>
      ),
    },
    {
      heading: "16. Modificacions del servei",
      body: (
        <>
          <p>FotoChess pot introduir modificacions per:</p>
          <ul>
            <li>millorar el servei;</li>
            <li>corregir errors;</li>
            <li>reforçar la seguretat;</li>
            <li>adaptar-se a canvis legals;</li>
            <li>incorporar o retirar funcionalitats;</li>
            <li>ajustar-se als serveis de tercers;</li>
            <li>evitar abusos o sobrecàrregues.</li>
          </ul>
          <p>Quan un canvi afecti substancialment els drets o obligacions dels usuaris, s'informarà de manera visible amb una antelació raonable, excepte quan el canvi sigui urgent per motius legals o de seguretat.</p>
        </>
      ),
    },
    {
      heading: "17. Modificacions de les condicions",
      body: (
        <>
          <p>FotoChess pot actualitzar aquestes Condicions d'ús quan canviïn:</p>
          <ul>
            <li>les funcionalitats;</li>
            <li>el model de prestació;</li>
            <li>les mesures de seguretat;</li>
            <li>els proveïdors;</li>
            <li>les obligacions legals;</li>
            <li>els riscos d'abús.</li>
          </ul>
          <p>La versió vigent indicarà la data de l'última actualització.</p>
          <p>Les condicions actualitzades seran aplicables des de la data indicada. Quan els canvis siguin substancials, se n'informarà de manera visible abans que entrin en vigor.</p>
        </>
      ),
    },
    {
      heading: "18. Legislació aplicable i resolució de conflictes",
      body: (
        <>
          <p>Aquestes Condicions d'ús es regeixen per la legislació espanyola, sense perjudici de les normes imperatives que resultin aplicables en funció del lloc de residència de l'usuari.</p>
          <p>Qualsevol controvèrsia se sotmetrà als jutjats i tribunals que corresponguin d'acord amb la normativa aplicable.</p>
          <p>Quan l'usuari tingui la condició de consumidor, es respectaran els drets i les regles de competència territorial que la legislació li reconegui.</p>
          <p>Abans d'iniciar una reclamació judicial, les parts poden intentar resoldre la qüestió de manera amistosa mitjançant el correu de contacte de FotoChess.</p>
        </>
      ),
    },
    {
      heading: "19. Contacte",
      body: (
        <>
          <p>Per a consultes relacionades amb aquestes condicions, usos indeguts, incidències de seguretat o funcionament del servei:</p>
          <p><EmailLink /></p>
        </>
      ),
    },
  ],
};

// ─── Content — Spanish ───────────────────────────────────────────────────────

const CONTENT_ES: TermsContent = {
  title: "Condiciones de uso de FotoChess",
  lastUpdated: "Última actualización: 29 de julio de 2026",
  backLink: "Volver a FotoChess",
  ariaLabel: "Volver a FotoChess",
  intro: (
    <>
      <p>Estas Condiciones de uso regulan el acceso y la utilización de FotoChess.</p>
      <p>Al utilizar FotoChess, el usuario se compromete a hacer un uso responsable, lícito y conforme con estas condiciones.</p>
    </>
  ),
  sections: [
    {
      heading: "1. Titular y datos de contacto",
      body: (
        <>
          <p>FotoChess es un servicio creado y gestionado por:</p>
          <ul>
            <li><strong>Responsable:</strong> Marc Tortajada Vinyes, creador y responsable de FotoChess</li>
            <li><strong>País:</strong> España</li>
            <li><strong>Correo de contacto:</strong> <EmailLink /></li>
          </ul>
          <p>El usuario puede utilizar este correo para comunicar incidencias, consultas relacionadas con el servicio o posibles usos indebidos.</p>
        </>
      ),
    },
    {
      heading: "2. Objeto del servicio",
      body: (
        <>
          <p>FotoChess permite, entre otras funciones:</p>
          <ul>
            <li>digitalizar planillas de ajedrez a partir de imágenes aportadas por el usuario;</li>
            <li>generar un PGN provisional o final;</li>
            <li>revisar y corregir jugadas;</li>
            <li>visualizar la partida en un tablero;</li>
            <li>copiar, descargar y exportar el PGN;</li>
            <li>guardar y consultar partidas en el Google Drive del propio usuario;</li>
            <li>analizar posiciones y partidas de ajedrez;</li>
            <li>gestionar una biblioteca personal de partidas dentro de la cuenta de Google Drive del usuario.</li>
          </ul>
          <p>Las funciones disponibles pueden evolucionar, modificarse o ampliarse con el tiempo.</p>
        </>
      ),
    },
    {
      heading: "3. Uso personal y autorizado",
      body: (
        <>
          <p>FotoChess está destinado principalmente a la digitalización, consulta, estudio y análisis de partidas de ajedrez.</p>
          <p>El usuario puede utilizar el servicio con fines personales, educativos, deportivos, formativos o profesionales lícitos, siempre que:</p>
          <ul>
            <li>respete estas condiciones;</li>
            <li>no perjudique a FotoChess ni a otros usuarios;</li>
            <li>no utilice el servicio para actividades ilícitas;</li>
            <li>no intente eludir las medidas técnicas o de seguridad;</li>
            <li>no realice un uso automatizado o masivo sin autorización previa.</li>
          </ul>
          <p>El uso de FotoChess no concede al usuario ningún derecho de propiedad sobre el servicio, su diseño, su código, sus sistemas internos o su identidad visual.</p>
        </>
      ),
    },
    {
      heading: "4. Contenido aportado por el usuario",
      body: (
        <>
          <p>El usuario conserva los derechos que le correspondan sobre:</p>
          <ul>
            <li>las imágenes de las planillas que aporta;</li>
            <li>los datos de las partidas;</li>
            <li>los PGN generados a partir de sus planillas;</li>
            <li>las correcciones introducidas;</li>
            <li>los archivos que decida guardar en su Google Drive.</li>
          </ul>
          <p>El usuario autoriza a FotoChess únicamente a tratar temporalmente este contenido en la medida necesaria para prestar las funciones que solicita.</p>
          <p>FotoChess no adquiere la propiedad de las planillas, las partidas o los PGN del usuario.</p>
          <p>El usuario no debe subir imágenes:</p>
          <ul>
            <li>que no tenga derecho a utilizar;</li>
            <li>obtenidas de manera ilícita;</li>
            <li>que contengan información personal innecesaria;</li>
            <li>que vulneren derechos de terceros;</li>
            <li>que contengan software malicioso, contenido manipulado con fines abusivos o elementos destinados a atacar el servicio.</li>
          </ul>
        </>
      ),
    },
    {
      heading: "5. Exactitud del PGN y responsabilidad de revisión",
      body: (
        <>
          <p>FotoChess está diseñado para obtener un PGN fiable a partir de una planilla manuscrita, pero la lectura automática puede contener errores, omisiones o interpretaciones incorrectas.</p>
          <p>Cuando FotoChess detecta una jugada dudosa, puede solicitar la intervención del usuario para revisarla.</p>
          <p>El usuario es responsable de:</p>
          <ul>
            <li>revisar el PGN antes de considerarlo definitivo;</li>
            <li>comprobar los nombres, fechas, resultados y demás metadatos;</li>
            <li>corregir las jugadas que no coincidan con la planilla;</li>
            <li>verificar el archivo antes de utilizarlo en una base de datos, torneo, publicación o servicio externo.</li>
          </ul>
          <p>FotoChess no garantiza que cualquier imagen, caligrafía, formato o estado físico de la planilla pueda ser interpretado sin errores.</p>
        </>
      ),
    },
    {
      heading: "6. Análisis de ajedrez",
      body: (
        <>
          <p>Las evaluaciones, variantes y sugerencias mostradas durante el análisis tienen una finalidad informativa y formativa.</p>
          <p>El usuario debe tener en cuenta que:</p>
          <ul>
            <li>la evaluación depende de la posición, la profundidad y los recursos de cálculo disponibles;</li>
            <li>un análisis puede variar si se calcula con otros parámetros;</li>
            <li>las líneas mostradas no constituyen asesoramiento profesional;</li>
            <li>FotoChess no garantiza que una variante sea la única ni la mejor explicación posible de una posición.</li>
          </ul>
        </>
      ),
    },
    {
      heading: "7. Google Drive y servicios externos",
      body: (
        <>
          <p>La conexión con Google Drive es opcional y solo se activa cuando el usuario lo solicita.</p>
          <p>Los archivos se guardan en la cuenta de Google Drive del propio usuario, dentro de la carpeta «Chess Games».</p>
          <p>El usuario es responsable de:</p>
          <ul>
            <li>mantener la seguridad de su cuenta de Google;</li>
            <li>revisar los permisos concedidos;</li>
            <li>conservar o eliminar los archivos;</li>
            <li>revocar el acceso de FotoChess cuando lo considere conveniente.</li>
          </ul>
          <p>El uso de Google Drive, Chess.com, Lichess.org, ChessBase u otros servicios externos también está sujeto a las condiciones propias de esos servicios.</p>
          <p>FotoChess no controla la disponibilidad, las modificaciones, las restricciones o las decisiones adoptadas por esos terceros.</p>
          <p>FotoChess no está afiliada, patrocinada ni avalada por Chess.com, Lichess.org o ChessBase.</p>
        </>
      ),
    },
    {
      heading: "8. Usos prohibidos",
      body: (
        <>
          <p>Queda prohibido utilizar FotoChess para:</p>
          <ul>
            <li>cometer actividades ilícitas o facilitarlas;</li>
            <li>introducir, transmitir o distribuir software malicioso;</li>
            <li>interrumpir, degradar o impedir el funcionamiento normal del servicio;</li>
            <li>sobrecargar deliberadamente los servidores;</li>
            <li>ejecutar ataques de denegación de servicio;</li>
            <li>enviar un volumen desproporcionado de peticiones;</li>
            <li>crear procesos automatizados que consuman recursos de manera abusiva;</li>
            <li>eludir límites, controles, bloqueos o medidas de seguridad;</li>
            <li>acceder a datos, partidas, sesiones o recursos de otros usuarios;</li>
            <li>suplantar a otras personas;</li>
            <li>manipular peticiones o identificadores con el objetivo de obtener acceso no autorizado;</li>
            <li>explotar vulnerabilidades;</li>
            <li>realizar pruebas de penetración, escaneos de seguridad o pruebas de carga sin autorización previa y escrita;</li>
            <li>utilizar el servicio para crear un producto competidor mediante extracción automatizada o abusiva de información no pública;</li>
            <li>revender, subarrendar o proporcionar acceso comercial masivo al servicio sin autorización.</li>
          </ul>
        </>
      ),
    },
    {
      heading: "9. Automatización, robots y acceso masivo",
      body: (
        <>
          <p>FotoChess no ofrece actualmente una API pública para el uso automatizado del servicio.</p>
          <p>Sin autorización previa y escrita, no se permite:</p>
          <ul>
            <li>operar FotoChess mediante bots o scripts;</li>
            <li>enviar partidas de forma masiva;</li>
            <li>automatizar la carga de imágenes;</li>
            <li>automatizar consultas de análisis;</li>
            <li>realizar scraping sistemático;</li>
            <li>crear múltiples procesos simultáneos para evitar limitaciones;</li>
            <li>utilizar el servicio como infraestructura de procesamiento para otra aplicación.</li>
          </ul>
          <p>Las herramientas de accesibilidad, las funciones normales del navegador y los usos individuales razonables no se consideran automatización abusiva.</p>
        </>
      ),
    },
    {
      heading: "10. Protección del funcionamiento interno de FotoChess",
      body: (
        <>
          <p>El funcionamiento interno no público de FotoChess, incluidos sus sistemas, reglas, configuraciones, credenciales, claves, instrucciones internas, medidas de seguridad y procesos de tratamiento, forma parte de los activos protegidos del servicio.</p>
          <p>Queda prohibido intentar obtener, reconstruir, descubrir o explotar información interna no pública mediante:</p>
          <ul>
            <li>acceso no autorizado;</li>
            <li>explotación de vulnerabilidades;</li>
            <li>manipulación de peticiones;</li>
            <li>elusión de controles;</li>
            <li>extracción automatizada;</li>
            <li>uso abusivo del servicio;</li>
            <li>obtención o intento de obtención de credenciales, claves o secretos;</li>
            <li>interferencia con las comunicaciones entre el navegador y el servidor;</li>
            <li>reproducción sistemática destinada a copiar el funcionamiento no público del servicio.</li>
          </ul>
          <p>Esta prohibición no limita los derechos que la normativa imperativa reconozca a los usuarios legítimos, incluidos los actos necesarios para la interoperabilidad u otras actuaciones expresamente permitidas por la ley.</p>
          <p>Las personas que detecten una posible vulnerabilidad deben comunicarla de manera responsable a:</p>
          <p><EmailLink /></p>
          <p>No debe explotarse públicamente ni utilizarse para acceder a datos o interrumpir el servicio.</p>
        </>
      ),
    },
    {
      heading: "11. Propiedad intelectual",
      body: (
        <>
          <p>El nombre FotoChess, la identidad visual, el diseño de la interfaz, los textos originales, la organización del servicio y el código propio están protegidos por la normativa aplicable.</p>
          <p>No se permite, sin autorización:</p>
          <ul>
            <li>copiar o redistribuir sustancialmente la interfaz;</li>
            <li>utilizar la marca FotoChess de manera que genere confusión;</li>
            <li>presentar un producto de terceros como si estuviera afiliado a FotoChess;</li>
            <li>reproducir los elementos propios del servicio para crear una copia que pueda generar confusión;</li>
            <li>eliminar avisos de propiedad o atribución.</li>
          </ul>
          <p>Los componentes de terceros y de código abierto incorporados al servicio continúan sujetos a sus licencias respectivas.</p>
          <p>Estas condiciones no atribuyen a FotoChess derechos sobre las partidas o planillas aportadas por el usuario.</p>
        </>
      ),
    },
    {
      heading: "12. Disponibilidad, mantenimiento y fase beta",
      body: (
        <>
          <p>FotoChess puede encontrarse en fase beta, de prueba o de evolución activa.</p>
          <p>El servicio puede experimentar:</p>
          <ul>
            <li>interrupciones temporales;</li>
            <li>mantenimiento;</li>
            <li>cambios de funcionalidad;</li>
            <li>limitaciones de capacidad;</li>
            <li>tiempos de espera;</li>
            <li>incompatibilidades puntuales;</li>
            <li>errores no detectados;</li>
            <li>modificaciones derivadas de servicios de terceros.</li>
          </ul>
          <p>FotoChess procurará mantener el servicio disponible y estable, pero no garantiza una disponibilidad permanente o ininterrumpida.</p>
          <p>Se pueden establecer límites razonables de uso para proteger la estabilidad, la seguridad y el acceso equitativo de los usuarios.</p>
        </>
      ),
    },
    {
      heading: "13. Suspensión o limitación del acceso",
      body: (
        <>
          <p>FotoChess puede limitar o suspender temporalmente el acceso cuando existan indicios razonables de:</p>
          <ul>
            <li>ataque o intento de ataque;</li>
            <li>uso automatizado abusivo;</li>
            <li>sobrecarga deliberada;</li>
            <li>acceso no autorizado;</li>
            <li>vulneración grave de estas condiciones;</li>
            <li>riesgo para la seguridad, los datos o la continuidad del servicio;</li>
            <li>obligación legal o requerimiento de una autoridad competente.</li>
          </ul>
          <p>Cuando sea posible y proporcionado, se intentará que la medida afecte únicamente a la actividad o al acceso problemático.</p>
          <p>FotoChess puede conservar la información técnica estrictamente necesaria para investigar el incidente, aplicar medidas de seguridad o atender responsabilidades legales.</p>
        </>
      ),
    },
    {
      heading: "14. Responsabilidad",
      body: (
        <>
          <p>FotoChess se presta con la diligencia razonablemente exigible según las características del servicio.</p>
          <p>Dentro de los límites permitidos por la normativa aplicable, FotoChess no será responsable de los perjuicios derivados exclusivamente de:</p>
          <ul>
            <li>el uso de un PGN que el usuario no haya revisado;</li>
            <li>datos incorrectos introducidos o confirmados por el usuario;</li>
            <li>la mala calidad o ilegibilidad de una imagen;</li>
            <li>la pérdida de archivos eliminados por el propio usuario de su Google Drive;</li>
            <li>decisiones tomadas exclusivamente a partir del análisis;</li>
            <li>indisponibilidad o cambios de servicios externos;</li>
            <li>uso fraudulento del dispositivo o de la cuenta de Google del usuario;</li>
            <li>usos contrarios a estas condiciones.</li>
          </ul>
          <p>Nada de este apartado excluye o limita los derechos obligatorios de los consumidores ni la responsabilidad que no pueda excluirse legalmente.</p>
        </>
      ),
    },
    {
      heading: "15. Privacidad",
      body: (
        <>
          <p>El tratamiento de los datos personales y de las imágenes aportadas se describe en la Política de privacidad de FotoChess, accesible desde la página principal.</p>
          <p>La Política de privacidad forma parte de la información aplicable al uso del servicio.</p>
        </>
      ),
    },
    {
      heading: "16. Modificaciones del servicio",
      body: (
        <>
          <p>FotoChess puede introducir modificaciones para:</p>
          <ul>
            <li>mejorar el servicio;</li>
            <li>corregir errores;</li>
            <li>reforzar la seguridad;</li>
            <li>adaptarse a cambios legales;</li>
            <li>incorporar o retirar funcionalidades;</li>
            <li>ajustarse a servicios de terceros;</li>
            <li>evitar abusos o sobrecargas.</li>
          </ul>
          <p>Cuando un cambio afecte sustancialmente a los derechos u obligaciones de los usuarios, se informará de forma visible con una antelación razonable, salvo cuando el cambio sea urgente por razones legales o de seguridad.</p>
        </>
      ),
    },
    {
      heading: "17. Modificaciones de las condiciones",
      body: (
        <>
          <p>FotoChess puede actualizar estas Condiciones de uso cuando cambien:</p>
          <ul>
            <li>las funcionalidades;</li>
            <li>el modelo de prestación;</li>
            <li>las medidas de seguridad;</li>
            <li>los proveedores;</li>
            <li>las obligaciones legales;</li>
            <li>los riesgos de abuso.</li>
          </ul>
          <p>La versión vigente indicará la fecha de la última actualización.</p>
          <p>Las condiciones actualizadas serán aplicables desde la fecha indicada. Cuando los cambios sean sustanciales, se informará de forma visible antes de que entren en vigor.</p>
        </>
      ),
    },
    {
      heading: "18. Legislación aplicable y resolución de conflictos",
      body: (
        <>
          <p>Estas Condiciones de uso se rigen por la legislación española, sin perjuicio de las normas imperativas aplicables según el lugar de residencia del usuario.</p>
          <p>Cualquier controversia se someterá a los juzgados y tribunales que correspondan conforme a la normativa aplicable.</p>
          <p>Cuando el usuario tenga la condición de consumidor, se respetarán los derechos y las reglas de competencia territorial que la legislación le reconozca.</p>
          <p>Antes de iniciar una reclamación judicial, las partes pueden intentar resolver la cuestión amistosamente mediante el correo de contacto de FotoChess.</p>
        </>
      ),
    },
    {
      heading: "19. Contacto",
      body: (
        <>
          <p>Para consultas relacionadas con estas condiciones, usos indebidos, incidencias de seguridad o funcionamiento del servicio:</p>
          <p><EmailLink /></p>
        </>
      ),
    },
  ],
};

// ─── Content — English ───────────────────────────────────────────────────────

const CONTENT_EN: TermsContent = {
  title: "FotoChess Terms of Use",
  lastUpdated: "Last updated: July 29, 2026",
  backLink: "Back to FotoChess",
  ariaLabel: "Back to FotoChess",
  intro: (
    <>
      <p>These Terms of Use govern access to and use of FotoChess.</p>
      <p>By using FotoChess, the user agrees to use it responsibly, lawfully and in accordance with these terms.</p>
    </>
  ),
  sections: [
    {
      heading: "1. Service owner and contact details",
      body: (
        <>
          <p>FotoChess is a service created and managed by:</p>
          <ul>
            <li><strong>Controller:</strong> Marc Tortajada Vinyes, creator and person responsible for FotoChess</li>
            <li><strong>Country:</strong> Spain</li>
            <li><strong>Contact email:</strong> <EmailLink /></li>
          </ul>
          <p>Users may use this email address to report incidents, submit enquiries related to the service or report possible misuse.</p>
        </>
      ),
    },
    {
      heading: "2. Purpose of the service",
      body: (
        <>
          <p>FotoChess provides features including:</p>
          <ul>
            <li>digitising chess scoresheets from images supplied by the user;</li>
            <li>generating a provisional or final PGN;</li>
            <li>reviewing and correcting moves;</li>
            <li>displaying the game on a chessboard;</li>
            <li>copying, downloading and exporting the PGN;</li>
            <li>saving and viewing games in the user's own Google Drive;</li>
            <li>analysing chess positions and games;</li>
            <li>managing a personal game library within the user's Google Drive account.</li>
          </ul>
          <p>Available features may evolve, change or be expanded over time.</p>
        </>
      ),
    },
    {
      heading: "3. Personal and authorised use",
      body: (
        <>
          <p>FotoChess is intended primarily for the digitisation, consultation, study and analysis of chess games.</p>
          <p>Users may use the service for lawful personal, educational, sporting, training or professional purposes, provided that they:</p>
          <ul>
            <li>comply with these terms;</li>
            <li>do not harm FotoChess or other users;</li>
            <li>do not use the service for unlawful activities;</li>
            <li>do not attempt to bypass technical or security measures;</li>
            <li>do not make automated or large-scale use without prior authorisation.</li>
          </ul>
          <p>Use of FotoChess does not grant the user any ownership rights over the service, its design, code, internal systems or visual identity.</p>
        </>
      ),
    },
    {
      heading: "4. User-provided content",
      body: (
        <>
          <p>Users retain any rights they hold over:</p>
          <ul>
            <li>the scoresheet images they provide;</li>
            <li>game data;</li>
            <li>PGNs generated from their scoresheets;</li>
            <li>corrections they enter;</li>
            <li>files they choose to save to their Google Drive.</li>
          </ul>
          <p>The user authorises FotoChess solely to process this content temporarily to the extent necessary to provide the requested features.</p>
          <p>FotoChess does not acquire ownership of the user's scoresheets, games or PGNs.</p>
          <p>Users must not upload images:</p>
          <ul>
            <li>that they are not entitled to use;</li>
            <li>obtained unlawfully;</li>
            <li>containing unnecessary personal information;</li>
            <li>infringing third-party rights;</li>
            <li>containing malicious software, content manipulated for abusive purposes or elements intended to attack the service.</li>
          </ul>
        </>
      ),
    },
    {
      heading: "5. PGN accuracy and review responsibility",
      body: (
        <>
          <p>FotoChess is designed to produce a reliable PGN from a handwritten scoresheet, but automated reading may contain errors, omissions or incorrect interpretations.</p>
          <p>When FotoChess detects a doubtful move, it may ask the user to review it.</p>
          <p>The user is responsible for:</p>
          <ul>
            <li>reviewing the PGN before considering it final;</li>
            <li>checking names, dates, results and other metadata;</li>
            <li>correcting moves that do not match the scoresheet;</li>
            <li>verifying the file before using it in a database, tournament, publication or external service.</li>
          </ul>
          <p>FotoChess does not guarantee that every image, handwriting style, format or physical condition of a scoresheet can be interpreted without error.</p>
        </>
      ),
    },
    {
      heading: "6. Chess analysis",
      body: (
        <>
          <p>Evaluations, variations and suggestions displayed during analysis are provided for informational and educational purposes.</p>
          <p>Users should bear in mind that:</p>
          <ul>
            <li>an evaluation depends on the position, depth and available computing resources;</li>
            <li>an analysis may vary when calculated using different parameters;</li>
            <li>displayed lines do not constitute professional advice;</li>
            <li>FotoChess does not guarantee that a variation is the only or best possible explanation of a position.</li>
          </ul>
        </>
      ),
    },
    {
      heading: "7. Google Drive and external services",
      body: (
        <>
          <p>Connecting to Google Drive is optional and is activated only when requested by the user.</p>
          <p>Files are saved in the user's own Google Drive account inside the "Chess Games" folder.</p>
          <p>The user is responsible for:</p>
          <ul>
            <li>maintaining the security of their Google Account;</li>
            <li>reviewing granted permissions;</li>
            <li>retaining or deleting files;</li>
            <li>revoking FotoChess access when they consider it appropriate.</li>
          </ul>
          <p>Use of Google Drive, Chess.com, Lichess.org, ChessBase or other external services is also subject to those services' own terms.</p>
          <p>FotoChess does not control the availability, modifications, restrictions or decisions of these third parties.</p>
          <p>FotoChess is not affiliated with, sponsored by or endorsed by Chess.com, Lichess.org or ChessBase.</p>
        </>
      ),
    },
    {
      heading: "8. Prohibited uses",
      body: (
        <>
          <p>Users must not use FotoChess to:</p>
          <ul>
            <li>carry out or facilitate unlawful activities;</li>
            <li>introduce, transmit or distribute malicious software;</li>
            <li>interrupt, degrade or prevent normal operation of the service;</li>
            <li>deliberately overload servers;</li>
            <li>conduct denial-of-service attacks;</li>
            <li>submit a disproportionate volume of requests;</li>
            <li>create automated processes that consume resources abusively;</li>
            <li>bypass limits, controls, blocks or security measures;</li>
            <li>access other users' data, games, sessions or resources;</li>
            <li>impersonate another person;</li>
            <li>manipulate requests or identifiers to gain unauthorised access;</li>
            <li>exploit vulnerabilities;</li>
            <li>conduct penetration testing, security scanning or load testing without prior written authorisation;</li>
            <li>use the service to create a competing product through automated or abusive extraction of non-public information;</li>
            <li>resell, sublicense or provide large-scale commercial access to the service without authorisation.</li>
          </ul>
        </>
      ),
    },
    {
      heading: "9. Automation, robots and large-scale access",
      body: (
        <>
          <p>FotoChess does not currently provide a public API for automated use.</p>
          <p>Without prior written authorisation, users may not:</p>
          <ul>
            <li>operate FotoChess through bots or scripts;</li>
            <li>submit games in bulk;</li>
            <li>automate image uploads;</li>
            <li>automate analysis requests;</li>
            <li>perform systematic scraping;</li>
            <li>create multiple simultaneous processes to bypass limitations;</li>
            <li>use the service as processing infrastructure for another application.</li>
          </ul>
          <p>Accessibility tools, ordinary browser functionality and reasonable individual use are not considered abusive automation.</p>
        </>
      ),
    },
    {
      heading: "10. Protection of FotoChess's internal operation",
      body: (
        <>
          <p>FotoChess's non-public internal operation, including its systems, rules, configurations, credentials, keys, internal instructions, security measures and processing procedures, forms part of the service's protected assets.</p>
          <p>Users must not attempt to obtain, reconstruct, discover or exploit non-public internal information through:</p>
          <ul>
            <li>unauthorised access;</li>
            <li>exploitation of vulnerabilities;</li>
            <li>manipulation of requests;</li>
            <li>bypassing controls;</li>
            <li>automated extraction;</li>
            <li>abusive use of the service;</li>
            <li>obtaining or attempting to obtain credentials, keys or secrets;</li>
            <li>interference with communications between the browser and server;</li>
            <li>systematic reproduction intended to copy the service's non-public operation.</li>
          </ul>
          <p>This restriction does not limit rights granted to legitimate users by mandatory law, including acts necessary for interoperability or other actions expressly permitted by law.</p>
          <p>Anyone identifying a potential vulnerability should report it responsibly to:</p>
          <p><EmailLink /></p>
          <p>It must not be publicly exploited or used to access data or disrupt the service.</p>
        </>
      ),
    },
    {
      heading: "11. Intellectual property",
      body: (
        <>
          <p>The FotoChess name, visual identity, interface design, original texts, service organisation and proprietary code are protected under applicable law.</p>
          <p>Without authorisation, users may not:</p>
          <ul>
            <li>substantially copy or redistribute the interface;</li>
            <li>use the FotoChess name in a manner likely to cause confusion;</li>
            <li>present a third-party product as affiliated with FotoChess;</li>
            <li>reproduce proprietary elements of the service to create a confusingly similar copy;</li>
            <li>remove ownership or attribution notices.</li>
          </ul>
          <p>Third-party and open-source components incorporated into the service remain subject to their respective licences.</p>
          <p>These terms do not give FotoChess rights over games or scoresheets provided by the user.</p>
        </>
      ),
    },
    {
      heading: "12. Availability, maintenance and beta status",
      body: (
        <>
          <p>FotoChess may be in beta, testing or active development.</p>
          <p>The service may experience:</p>
          <ul>
            <li>temporary interruptions;</li>
            <li>maintenance;</li>
            <li>feature changes;</li>
            <li>capacity limitations;</li>
            <li>waiting times;</li>
            <li>occasional incompatibilities;</li>
            <li>undetected errors;</li>
            <li>changes resulting from third-party services.</li>
          </ul>
          <p>FotoChess will seek to keep the service available and stable but does not guarantee permanent or uninterrupted availability.</p>
          <p>Reasonable usage limits may be established to protect stability, security and fair access for users.</p>
        </>
      ),
    },
    {
      heading: "13. Suspension or restriction of access",
      body: (
        <>
          <p>FotoChess may temporarily restrict or suspend access where there are reasonable indications of:</p>
          <ul>
            <li>an attack or attempted attack;</li>
            <li>abusive automated use;</li>
            <li>deliberate overloading;</li>
            <li>unauthorised access;</li>
            <li>a serious breach of these terms;</li>
            <li>a risk to security, data or service continuity;</li>
            <li>a legal obligation or request from a competent authority.</li>
          </ul>
          <p>Where possible and proportionate, the measure will be limited to the problematic activity or access.</p>
          <p>FotoChess may retain technical information strictly necessary to investigate the incident, apply security measures or address legal responsibilities.</p>
        </>
      ),
    },
    {
      heading: "14. Liability",
      body: (
        <>
          <p>FotoChess is provided with the level of reasonable care appropriate to the nature of the service.</p>
          <p>To the extent permitted by applicable law, FotoChess will not be liable for damage arising exclusively from:</p>
          <ul>
            <li>use of a PGN that the user has not reviewed;</li>
            <li>incorrect data entered or confirmed by the user;</li>
            <li>poor quality or illegibility of an image;</li>
            <li>loss of files deleted by the user from their Google Drive;</li>
            <li>decisions made solely on the basis of analysis;</li>
            <li>unavailability or changes to external services;</li>
            <li>fraudulent use of the user's device or Google Account;</li>
            <li>uses contrary to these terms.</li>
          </ul>
          <p>Nothing in this section excludes or limits mandatory consumer rights or liability that cannot legally be excluded.</p>
        </>
      ),
    },
    {
      heading: "15. Privacy",
      body: (
        <>
          <p>The processing of personal data and submitted images is described in the FotoChess Privacy Policy, accessible from the home page.</p>
          <p>The Privacy Policy forms part of the information applicable to use of the service.</p>
        </>
      ),
    },
    {
      heading: "16. Changes to the service",
      body: (
        <>
          <p>FotoChess may introduce changes to:</p>
          <ul>
            <li>improve the service;</li>
            <li>correct errors;</li>
            <li>strengthen security;</li>
            <li>adapt to legal changes;</li>
            <li>add or remove features;</li>
            <li>adapt to third-party services;</li>
            <li>prevent abuse or overloading.</li>
          </ul>
          <p>Where a change substantially affects users' rights or obligations, users will be informed visibly with reasonable notice, except where the change is urgent for legal or security reasons.</p>
        </>
      ),
    },
    {
      heading: "17. Changes to these terms",
      body: (
        <>
          <p>FotoChess may update these Terms of Use when there are changes to:</p>
          <ul>
            <li>features;</li>
            <li>the service model;</li>
            <li>security measures;</li>
            <li>providers;</li>
            <li>legal obligations;</li>
            <li>risks of abuse.</li>
          </ul>
          <p>The current version will always state the date of the latest update.</p>
          <p>The updated terms will apply from the date indicated. Where changes are substantial, users will be informed visibly before they take effect.</p>
        </>
      ),
    },
    {
      heading: "18. Governing law and dispute resolution",
      body: (
        <>
          <p>These Terms of Use are governed by Spanish law, without prejudice to mandatory rules applicable according to the user's place of residence.</p>
          <p>Any dispute will be submitted to the courts and tribunals having jurisdiction under applicable law.</p>
          <p>Where the user is a consumer, the rights and territorial jurisdiction rules granted by consumer law will be respected.</p>
          <p>Before initiating court proceedings, the parties may attempt to resolve the matter amicably through the FotoChess contact email address.</p>
        </>
      ),
    },
    {
      heading: "19. Contact",
      body: (
        <>
          <p>For enquiries related to these terms, misuse, security incidents or operation of the service:</p>
          <p><EmailLink /></p>
        </>
      ),
    },
  ],
};

// ─── Content map ──────────────────────────────────────────────────────────────

const CONTENT: Record<Lang, TermsContent> = {
  ca: CONTENT_CA,
  es: CONTENT_ES,
  en: CONTENT_EN,
};

// ─── Page component ───────────────────────────────────────────────────────────

export default function Terms() {
  const [lang, setLang] = useState<Lang>("ca");

  useEffect(() => {
    setLang(readStoredLang());
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const content = CONTENT[lang];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <Link
              href="/"
              aria-label={content.ariaLabel}
              className="inline-flex items-center justify-center rounded-md p-1.5 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              href="/"
              className="font-display font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
            >
              FotoChess
            </Link>
          </div>

          {/* Language selector */}
          <nav aria-label="Language selector" className="flex items-center gap-1 text-xs text-muted-foreground">
            {(["ca", "en", "es"] as Lang[]).map((l, i) => (
              <span key={l} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true">·</span>}
                <button
                  onClick={() => setLang(l)}
                  className={`hover:text-foreground transition-colors px-0.5 ${
                    lang === l ? "text-foreground font-medium" : ""
                  }`}
                  aria-current={lang === l ? "true" : undefined}
                >
                  {LANG_LABELS[l]}
                </button>
              </span>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-display font-bold mb-1">{content.title}</h1>
        <p className="text-xs text-muted-foreground mb-6">{content.lastUpdated}</p>

        <div className="text-sm leading-relaxed text-muted-foreground space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:leading-relaxed [&_strong]:text-foreground mb-8">
          {content.intro}
        </div>

        <div className="space-y-8">
          {content.sections.map((section) => (
            <section key={section.heading} aria-labelledby={section.heading}>
              <h2 className="text-base font-semibold mb-3">{section.heading}</h2>
              <div className="text-sm leading-relaxed text-muted-foreground space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:leading-relaxed [&_strong]:text-foreground">
                {section.body}
              </div>
            </section>
          ))}
        </div>

        {/* Back link */}
        <div className="mt-12 pt-6 border-t border-border">
          <Link
            href="/"
            className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
          >
            ← {content.backLink}
          </Link>
        </div>
      </main>
    </div>
  );
}
