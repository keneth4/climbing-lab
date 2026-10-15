<script lang="ts">
  import SiteHeader from './SiteHeader.svelte';
  import SitePublic from './SitePublic.svelte';
  import SiteFooter from './SiteFooter.svelte';
  import RouteCatalog from './RouteCatalog.svelte';
  import { site, viewFromUrl, pageTitle } from './site';
  import QRCode from 'qrcode';
  import RoutePresentation from './RoutePresentation.svelte';
  import SharePreview from './SharePreview.svelte';
  import PilotMetrics from './PilotMetrics.svelte';
  import MyReports from './MyReports.svelte';
  import DemoImport from './DemoImport.svelte';
  import {
    normalize,
    gradeScale,
    gradeRank,
    newDraft,
    privateFields,
    sharedPersonal,
    measure,
    type ActivityDraft,
    type EditorDraft,
  } from './pilot';
  import { onMount, setContext, untrack } from 'svelte';
  import SplatRuntime from './SplatRuntime.svelte';
  import { VIEWER_CONTEXT, ViewerWorkspace } from './viewer-context.svelte';
  const viewerWorkspace = new ViewerWorkspace();
  setContext(VIEWER_CONTEXT, viewerWorkspace);
  let viewerHome: HTMLDivElement;
  function placeViewer(node: HTMLElement) {
    $effect(() => {
      const target = viewerWorkspace.active?.target || viewerHome;
      if (target && node.parentElement !== target) target.appendChild(node);
    });
  }
  import EntryHistory from './EntryHistory.svelte';
  import EntryRetirement from './EntryRetirement.svelte';
  import JournalEntry from './JournalEntry.svelte';
  import OperationsPanel from './OperationsPanel.svelte';
  import StorePanel from './StorePanel.svelte';
  import HistoricalExport from './HistoricalExport.svelte';
  import ProjectsPanel from './ProjectsPanel.svelte';
  import JournalControls from './JournalControls.svelte';
  import AuthPanel from './AuthPanel.svelte';
  import RouteEditor from './RouteEditor.svelte';
  import CaptureManager from './CaptureManager.svelte';
  import type { Capture, Section } from './twin';
  import { supabase, api, ApiError, setApiOwner } from './auth';
  import SplatViewer from './SplatViewer.svelte';
  import { loadState, routeUrl, type Entry } from './domain';
  let db = $state(loadState());
  db.routes = [];
  db.entries = [];
  db.reports = [];
  let userEmail = $state('');
  let userId = $state('');
  let gymConfig = $state({
    name: 'Gimnasio piloto',
    currency: 'MXN',
    timezone: 'America/Mexico_City',
  });
  onMount(() => {
    let disposed = false;
    api('/config')
      .then((d) => {
        if (!disposed && d.config) gymConfig = d.config;
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  });
  let adminRole = $state(false);
  let editingEntry = $state<Entry | undefined>(),
    retiringEntry = $state<Entry | undefined>(),
    historyEntryId = $state(''),
    mediaEntry = $state<Entry | undefined>();
  let journalEntryOpen = $state(false),
    journalNotice = $state('');
  let routePreparing = $state(false);
  let editorDrafts = $state<Record<string, EditorDraft>>({});
  function clearEditorPreparation(id: string) {
    const prefix = `${userId}:${id}:`;
    for (const key of Object.keys(editorDrafts))
      if (key.startsWith(prefix)) delete editorDrafts[key];
  }
  function editorPreparation(
    id: string,
    revision: number,
  ): EditorDraft | undefined {
    const prefix = `${userId}:${id}:`;
    const exact = editorDrafts[`${prefix}${revision}`];
    if (exact && Object.keys(exact).length) return exact;
    const prior = Object.entries(editorDrafts)
      .filter(
        ([key, value]) =>
          key.startsWith(prefix) &&
          Object.keys(value).length &&
          Number(key.slice(prefix.length)) < revision,
      )
      .sort(
        ([a], [b]) =>
          Number(b.slice(prefix.length)) - Number(a.slice(prefix.length)),
      )[0];
    return prior
      ? { ...prior[1], basedOnRevision: Number(prior[0].slice(prefix.length)) }
      : undefined;
  }

  let historicalSection = $state<Section | undefined>();
  let sectionTicket = 0;
  $effect(() => {
    const route = selected;
    const list = sections;
    const ticket = ++sectionTicket;
    historicalSection = undefined;
    const current = list.find((s) => s.id === route?.sectionId);
    const rev = route?.sectionRevision || 1;
    if (!route?.sectionId || !current || (current.revision || 1) === rev)
      return;
    api(`/sections/${route.sectionId}/revisions/${rev}`)
      .then((d) => {
        if (ticket === sectionTicket) historicalSection = d.section;
      })
      .catch((e) => {
        if (ticket === sectionTicket) message = e.message;
      });
  });
  let currentCapture = $state<Capture | undefined>();
  let selectedCapture = $state<Capture | undefined>();
  let sections = $state<Section[]>([]);
  let sessionReady = $state(false);
  let accessState = $state<
    'checking' | 'offline' | 'invalid' | 'confirmed' | 'anonymous'
  >('checking');
  let accessError = $state('');
  let generation = 0;
  let routesTicket = 0;
  async function refreshSession() {
    const ticket = ++generation;
    sessionReady = false;
    accessState = 'checking';
    accessError = '';
    historyEntryId = '';
    db.entries = [];
    db.reports = [];
    staff = false;
    adminRole = false;
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError)
        throw new ApiError('Sesión inválida. Inicia sesión nuevamente.', 401);
      if (ticket !== generation) return;
      const nextEmail = data.session?.user.email || '';
      const nextUserId = data.session?.user.id || '';
      if (nextUserId !== userId) {
        routesTicket++;
        db.routes = db.routes.filter((r) => r.status !== 'borrador');
        viewerWorkspace.reset();
        show3D = false;
        journalEntryOpen = false;
        editingEntry = undefined;
        retiringEntry = undefined;
        historyEntryId = '';
        mediaEntry = undefined;
        journalNotice = '';
        shareFields = privateFields();
        shareOpen = false;
        shareEntry = undefined;
        drafts = {};
        editorDrafts = {};
        activityNotice = '';
        reportNotice = '';
        savedActivity = undefined;
        requestOwner++;
        if (nextUserId && loginReturn) {
          try {
            const pending = JSON.parse(
              sessionStorage.getItem('climbing-login-draft') || 'null',
            );
            if (
              pending?.routeId === loginReturn &&
              pending.draft &&
              (!pending.sourceOwner || pending.sourceOwner === nextUserId)
            )
              drafts[`${nextUserId}:${pending.routeId}:${pending.revision}`] =
                pending.draft;
          } catch {}
          sessionStorage.removeItem('climbing-login-draft');
        }
        name = '';
        accountNotice = '';
      }
      userEmail = nextEmail;
      userId = nextUserId;
      setApiOwner(nextUserId);
      if (!data.session) {
        accessState = 'anonymous';
        void refreshRoutes();
        return;
      }
      const me = await api('/me');
      if (ticket !== generation) return;
      staff = !!me.staff;
      adminRole = me.staff === 'admin';
      accessState = 'confirmed';
      sessionReady = true;
      if (tab === 'Cuenta' && loginReturn) {
        const target = loginReturn;
        loginReturn = '';
        sessionStorage.removeItem('climbing-login-return');
        sessionStorage.removeItem('climbing-login-draft');
        navigate('Catálogo', target);
      }
      void refreshRoutes();
      const dataEntries = await api('/entries');
      if (ticket !== generation) return;
      db.entries = dataEntries.entries.map((e: any) => ({
        id: e.id,
        routeId: e.route_id,
        revision: e.revision,
        routeName: e.route_name || e.route_id,
        grade: e.grade || '',
        date: e.created_at,
        attempts: e.attempts,
        result: e.result,
        notes: e.notes,
        holds: e.route_snapshot ? JSON.parse(e.route_snapshot).holds || [] : [],
      }));
      if (staff) {
        const reports = await api('/staff/reports');
        if (ticket !== generation) return;
        db.reports = reports.reports.map((r: any) => ({
          id: r.id,
          routeId: r.route_id,
          revision: r.revision,
          description: r.description,
          status: r.status,
          category: r.category,
          assignedTo: r.assigned_to,
          resolution: r.resolution,
        }));
      }
    } catch (e) {
      if (ticket !== generation) return;
      if (
        accessState !== 'confirmed' ||
        (e instanceof ApiError && (e.status === 0 || e.status >= 500))
      ) {
        staff = false;
        adminRole = false;
        accessState =
          e instanceof ApiError && e.status === 401 ? 'invalid' : 'offline';
        accessError = (e as Error).message;
      } else message = (e as Error).message;
    } finally {
      if (ticket === generation)
        sessionReady =
          accessState === 'confirmed' || accessState === 'anonymous';
    }
  }
  let catalogLoading = $state(true),
    catalogError = $state('');
  async function refreshRoutes(id?: string) {
    catalogLoading = true;
    catalogError = '';
    const ticket = ++routesTicket,
      owner = userId,
      authorized = staff;
    try {
      const list = async (status: string) => {
        const rows = [];
        for (let offset = 0; offset <= 10000; offset += 100) {
          const d = await api(
            `/routes?status=${status}&limit=100&offset=${offset}`,
          );
          rows.push(...d.routes);
          if (d.routes.length < 100) break;
        }
        return { routes: rows };
      };
      const lists = await Promise.all([
        list('activa'),
        list('retirada'),
        ...(staff ? [list('borrador')] : []),
      ]);
      const rows = [
        ...new Map(
          lists.flatMap((d) => d.routes).map((r) => [r.id, r]),
        ).values(),
      ];
      const routes = await Promise.all(
        rows.map(async (r: any) => {
          const detail = r.snapshot
            ? {
                snapshot:
                  typeof r.snapshot === 'string'
                    ? JSON.parse(r.snapshot)
                    : r.snapshot,
                revision: r.revision,
                status: r.status,
              }
            : await api(`/routes/${r.id}`);
          return {
            ...detail.snapshot,
            id: r.id,
            revision: detail.revision,
            status: detail.status,
            holds: detail.snapshot.holds || [],
            name: r.name,
            grade: r.grade,
            sector: r.sector,
            beta: r.beta,
          };
        }),
      );
      if (ticket !== routesTicket || owner !== userId || (authorized && !staff))
        return;
      db.routes = routes;
      if (id) select(id);
      else if (!selectedId) selectedId = routes[0]?.id || '';
      else if (!routes.some((r) => r.id === selectedId)) {
        const requestedId = selectedId;
        try {
          const d = await api(`/routes/${encodeURIComponent(requestedId)}`);
          if (
            ticket !== routesTicket ||
            owner !== userId ||
            selectedId !== requestedId
          )
            return;
          db.routes = [
            ...routes,
            {
              ...d.snapshot,
              id: requestedId,
              revision: d.revision,
              status: d.status,
              holds: d.snapshot.holds || [],
            },
          ];
        } catch {
          if (selectedId === requestedId && ticket === routesTicket)
            routeError = 'Ruta no encontrada o no disponible.';
        }
      }
    } catch (e) {
      if (ticket === routesTicket && owner === userId)
        catalogError = (e as Error).message;
    } finally {
      if (ticket === routesTicket) catalogLoading = false;
    }
  }
  async function refreshTwin() {
    try {
      const [a, b] = await Promise.all([
        api('/captures/current'),
        api('/sections'),
      ]);
      currentCapture = a.capture || undefined;
      sections = b.sections;
    } catch (e) {
      message = (e as Error).message;
    }
  }
  $effect(() => {
    const captureId = selected?.captureId;
    const current = currentCapture;
    selectedCapture = undefined;
    if (!captureId || captureId === current?.id) {
      selectedCapture = current;
      return;
    }
    api(`/captures/${captureId}/metadata`)
      .then((data) => {
        if (selected?.captureId === captureId) selectedCapture = data.capture;
      })
      .catch((e) => (message = e.message));
  });
  onMount(() => {
    refreshTwin();
    refreshRoutes();
    refreshSession();
    const { data } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => refreshSession(), 0);
    });
    const expired = () => {
      accessState = 'invalid';
      sessionReady = false;
      staff = false;
      adminRole = false;
      accessError =
        'Tu sesión venció. Inicia sesión para continuar; el borrador se conserva.';
    };
    window.addEventListener('climbing-session-expired', expired);
    return () => {
      window.removeEventListener('climbing-session-expired', expired);
      generation++;
      data.subscription.unsubscribe();
    };
  });
  let chrome: HTMLDivElement;
  let theme = $state(
    localStorage.getItem('climbing-theme') || site.brand.defaultTheme,
  );
  $effect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('climbing-theme', theme);
  });
  let toolsOpen = $state(true);
  let viewerStarted = $state(false);
  $effect(() => {
    if (viewerWorkspace.active) viewerStarted = true;
  });
  onMount(() => {
    const measureWorkspace = () => {
      const zoom = Number(getComputedStyle(document.documentElement).zoom) || 1;
      document.documentElement.style.setProperty(
        '--workspace-top',
        `${chrome.getBoundingClientRect().height / zoom}px`,
      );
      document.documentElement.style.setProperty(
        '--viewport-height',
        `${window.innerHeight / zoom}px`,
      );
      document.documentElement.style.setProperty(
        '--viewport-width',
        `${window.innerWidth / zoom}px`,
      );
    };
    const resize = new ResizeObserver(measureWorkspace);
    resize.observe(chrome);
    window.addEventListener('resize', measureWorkspace);
    return () => {
      resize.disconnect();
      window.removeEventListener('resize', measureWorkspace);
    };
  });
  const pageStarted = performance.now();
  let sceneStarted = 0,
    activityStarted = 0,
    lastSceneKey = '';
  const initialUrl = new URL(location.href);
  let tab = $state(viewFromUrl(initialUrl));
  let staff = $state(false);
  let selectedId = $state(initialUrl.searchParams.get('ruta') || '');
  let detailMode = $state(initialUrl.searchParams.has('ruta'));
  let routeError = $state('');
  let selected = $derived(
    db.routes.find(
      (r) => r.id === selectedId && (r.status !== 'borrador' || staff),
    ),
  );
  let query = $state(initialUrl.searchParams.get('buscar') || '');
  let grade = $state(initialUrl.searchParams.get('grado') || '');
  let sectorFilter = $state(initialUrl.searchParams.get('sector') || '');
  let scaleFilter = $state(initialUrl.searchParams.get('escala') || '');
  let minGrade = $state(initialUrl.searchParams.get('desde') || '');
  let maxGrade = $state(initialUrl.searchParams.get('hasta') || '');
  let order = $state(initialUrl.searchParams.get('orden') || 'recientes');
  let showRetired = $state(initialUrl.searchParams.get('retiradas') === '1');
  let filtered = $derived(
    db.routes
      .filter(
        (r) =>
          (r.status === 'activa' || (showRetired && r.status === 'retirada')) &&
          (!grade || r.grade === grade) &&
          (!sectorFilter || r.sector === sectorFilter) &&
          (!scaleFilter ||
            (r.gradeScale || gradeScale(r.grade)) === scaleFilter) &&
          (!minGrade ||
            (gradeRank(r.grade, scaleFilter) ?? -Infinity) >=
              (gradeRank(minGrade, scaleFilter) ?? Infinity)) &&
          (!maxGrade ||
            (gradeRank(r.grade, scaleFilter) ?? Infinity) <=
              (gradeRank(maxGrade, scaleFilter) ?? -Infinity)) &&
          normalize(`${r.name} ${r.sector}`).includes(normalize(query)),
      )
      .sort((a, b) =>
        order === 'nombre'
          ? a.name.localeCompare(b.name)
          : (b.updatedAt || '').localeCompare(a.updatedAt || ''),
      ),
  );
  $effect(() => {
    const filters = {
      buscar: query,
      grado: grade,
      sector: sectorFilter,
      escala: scaleFilter,
      desde: minGrade,
      hasta: maxGrade,
      orden: order,
      retiradas: showRetired ? '1' : '',
    };
    if (tab !== 'Catálogo') return;
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(filters)) {
      url.searchParams.delete(key);
      if (value) url.searchParams.set(key, value);
    }
    history.replaceState(history.state, '', url);
  });
  let drafts = $state<Record<string, ActivityDraft>>({});
  let draft = $derived.by(
    () =>
      drafts[`${userId}:${selectedId}:${selected?.revision || 0}`] ||
      newDraft(selected?.revision || 0),
  );
  $effect(() => {
    if (!selected) return;
    const key = `${userId}:${selected.id}:${selected.revision}`;
    if (!drafts[key]) {
      const previous = Object.entries(drafts).find(
        ([k, v]) =>
          k.startsWith(`${userId}:${selected!.id}:`) &&
          v.approvedRevision !== selected!.revision,
      );
      drafts[key] = previous
        ? {
            ...previous[1],
            activityKey: crypto.randomUUID(),
            reportKey: crypto.randomUUID(),
          }
        : newDraft(selected.revision);
    }
  });
  let message = $state('');
  let accountNotice = $state('');
  let activityNotice = $state(''),
    reportNotice = $state('');
  let activityError = $state(false),
    reportError = $state(false);
  let recordingActivity = $state(false),
    reporting = $state(false),
    projectBusy = $state(false);
  let savedActivity = $state<
    | {
        id: string;
        routeId: string;
        revision: number;
        owner: string;
        requestId: string;
      }
    | undefined
  >();
  let betaOpen = $state(false),
    show3D = $state(false),
    shareOpen = $state(false);
  let shareFields = $state(privateFields());
  let shareEntry = $state<Entry | undefined>();
  let requestOwner = 0;
  let loginReturn = $state(
    sessionStorage.getItem('climbing-login-return') || '',
  );
  function navigate(view: string, id?: string, push = true) {
    const previous = new URL(location.href);
    for (const [k, v] of Object.entries({
      buscar: query,
      grado: grade,
      sector: sectorFilter,
      escala: scaleFilter,
      desde: minGrade,
      hasta: maxGrade,
      orden: order,
      retiradas: showRetired ? '1' : '',
    })) {
      previous.searchParams.delete(k);
      if (v && tab === 'Catálogo') previous.searchParams.set(k, v);
    }
    history.replaceState(
      {
        ...history.state,
        scroll:
          document.getElementById('tools-panel')?.scrollTop || window.scrollY,
      },
      '',
      previous,
    );
    tab = view;
    if (id) selectedId = id;
    detailMode = !!id;
    toolsOpen = true;
    routeError = '';
    const url = new URL(location.href);
    url.pathname = '/';
    url.search = '';
    if (view !== 'Inicio') url.searchParams.set('vista', view);
    if (id) url.searchParams.set('ruta', id);
    for (const [k, v] of Object.entries({
      buscar: query,
      grado: grade,
      sector: sectorFilter,
      escala: scaleFilter,
      desde: minGrade,
      hasta: maxGrade,
      orden: order,
      retiradas: showRetired ? '1' : '',
    }))
      if (v && view === 'Catálogo') url.searchParams.set(k, v);
    if (push) history.pushState({ scroll: 0 }, '', url);
    else history.replaceState({ scroll: 0 }, '', url);
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      const panel = document.getElementById('tools-panel');
      if (panel) {
        panel.scrollTop = 0;
        const heading =
          panel.querySelector<HTMLElement>(
            id ? 'section[aria-label="Ficha de ruta"] h2' : 'h1, h2',
          ) || panel;
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
  }
  onMount(() => {
    if (initialUrl.searchParams.has('ruta')) measure('qr_open');
    const pop = () => {
      const url = new URL(location.href);
      tab = viewFromUrl(url);
      selectedId = url.searchParams.get('ruta') || selectedId;
      detailMode = url.searchParams.has('ruta');
      query = url.searchParams.get('buscar') || '';
      grade = url.searchParams.get('grado') || '';
      sectorFilter = url.searchParams.get('sector') || '';
      scaleFilter = url.searchParams.get('escala') || '';
      minGrade = url.searchParams.get('desde') || '';
      maxGrade = url.searchParams.get('hasta') || '';
      order = url.searchParams.get('orden') || 'recientes';
      showRetired = url.searchParams.get('retiradas') === '1';
      requestAnimationFrame(() => {
        const panel = document.getElementById('tools-panel');
        if (panel) {
          panel.scrollTop = history.state?.scroll || 0;
          panel.focus({ preventScroll: true });
        }
        window.scrollTo(0, history.state?.scroll || 0);
      });
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  });
  const selectionKey = $derived(`${selectedId}:${selected?.revision || 0}`);
  $effect(() => {
    selectionKey;
    betaOpen = false;
    activityNotice = '';
    reportNotice = '';
    shareOpen = false;
    shareEntry = undefined;
    if (untrack(() => !!selected))
      measure('detail_ready', performance.now() - pageStarted);
  });
  function login() {
    sessionStorage.setItem(
      'climbing-login-draft',
      JSON.stringify({
        routeId: selectedId,
        revision: selected?.revision,
        draft,
        sourceOwner: userId,
      }),
    );
    loginReturn = detailMode && tab === 'Catálogo' ? selectedId : '';
    sessionStorage.setItem('climbing-login-return', loginReturn);
    navigate('Cuenta');
  }
  function clearFilters() {
    query = '';
    grade = '';
    sectorFilter = '';
    scaleFilter = '';
    minGrade = '';
    maxGrade = '';
    showRetired = false;
    order = 'recientes';
  }
  let qr = $state('');
  let name = $state('');
  $effect(() => {
    const id = selectedId;
    qr = '';
    QRCode.toDataURL(routeUrl(id), { width: 220, margin: 2 })
      .then((value) => {
        if (selectedId === id) qr = value;
      })
      .catch(() => {
        message = 'No se pudo generar el QR.';
      });
  });
  function select(id: string) {
    navigate('Catálogo', id);
  }
  async function record() {
    if (
      !selected ||
      recordingActivity ||
      draft.approvedRevision !== selected.revision ||
      savedActivity?.requestId === draft.activityKey
    )
      return;
    const route = { ...selected },
      d = draft,
      owner = userId,
      ticket = requestOwner;
    const content = JSON.stringify({
      attempts: d.attempts,
      result: d.result,
      notes: d.notes,
    });
    recordingActivity = true;
    activityError = false;
    activityStarted = performance.now();
    activityNotice = 'Guardando actividad…';
    try {
      const result = await api(
        '/entries',
        {
          routeId: route.id,
          expectedRevision: route.revision,
          attempts: d.attempts,
          result: d.result,
          notes: d.notes,
          requestId: d.activityKey,
        },
        undefined,
        owner,
      );
      if (ticket !== requestOwner) return;
      savedActivity = {
        id: result.id,
        routeId: route.id,
        revision: route.revision,
        owner,
        requestId: d.activityKey,
      };
      if (
        JSON.stringify({
          attempts: d.attempts,
          result: d.result,
          notes: d.notes,
        }) === content
      ) {
        d.notes = '';
      }
      if (selectedId === route.id) activityNotice = 'Actividad guardada.';
      measure('activity_saved', performance.now() - activityStarted);
      await refreshSession();
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 401 &&
        ticket === requestOwner
      ) {
        accessState = 'invalid';
        accessError = e.message;
        sessionReady = false;
      }
      if (ticket === requestOwner && selectedId === route.id) {
        measure('activity_error');
        activityError = true;
        activityNotice = (e as Error).message;
        if (e instanceof ApiError && e.status === 409) await refreshRoutes();
      }
    } finally {
      recordingActivity = false;
    }
  }
  async function undoRecord() {
    const entry = savedActivity;
    if (!entry || entry.owner !== userId || recordingActivity) return;
    recordingActivity = true;
    try {
      await api(`/entries/${entry.id}`, { expectedVersion: 1 }, 'DELETE');
      savedActivity = undefined;
      if (selectedId === entry.routeId) draft.activityKey = crypto.randomUUID();
      activityNotice =
        'Registro retirado. Puedes volver a registrar la actividad.';
      await refreshSession();
    } catch (e) {
      activityError = true;
      activityNotice = (e as Error).message;
    } finally {
      recordingActivity = false;
    }
  }
  async function saveProject() {
    if (!selected || projectBusy) return;
    projectBusy = true;
    try {
      await api('/projects', { routeId: selected.id, notes: '' });
      activityError = false;
      activityNotice = 'Proyecto guardado. No se registró actividad.';
    } catch (e) {
      activityError = true;
      activityNotice = (e as Error).message;
    } finally {
      projectBusy = false;
    }
  }
  async function sendReport() {
    if (!selected || reporting || draft.approvedRevision !== selected.revision)
      return;
    const route = { ...selected },
      d = draft,
      owner = userId,
      ticket = requestOwner;
    reporting = true;
    reportError = false;
    reportNotice = 'Enviando reporte…';
    try {
      await api(
        '/reports',
        {
          routeId: route.id,
          expectedRevision: route.revision,
          description: d.report,
          category: d.category,
          requestId: d.reportKey,
        },
        undefined,
        owner,
      );
      if (ticket !== requestOwner) return;
      d.report = '';
      d.reportKey = crypto.randomUUID();
      if (selectedId === route.id) reportNotice = 'Reporte enviado al staff.';
      await refreshSession();
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 401 &&
        ticket === requestOwner
      ) {
        accessState = 'invalid';
        accessError = e.message;
        sessionReady = false;
      }
      if (ticket === requestOwner && selectedId === route.id) {
        reportError = true;
        reportNotice = (e as Error).message;
        if (e instanceof ApiError && e.status === 409) await refreshRoutes();
      }
    } finally {
      reporting = false;
    }
  }
  let resolutions = $state<Record<string, string>>({});
  async function takeReport(id: string) {
    try {
      await api(`/staff/reports/${id}/assign`, {});
      await refreshSession();
    } catch (e) {
      message = (e as Error).message;
    }
  }
  async function resolveReport(id: string) {
    try {
      await api(`/staff/reports/${id}/resolve`, {
        resolution: resolutions[id],
      });
      await refreshSession();
    } catch (e) {
      message = (e as Error).message;
    }
  }
  function download(data: string, filename: string) {
    const a = document.createElement('a');
    a.href = data;
    a.download = filename;
    a.click();
  }
  function exportImage(entry?: Entry) {
    shareEntry = entry;
    shareOpen = true;
  }
  $effect(() => {
    document.title = pageTitle(tab, detailMode ? selected?.name : undefined);
  });
</script>

<div bind:this={chrome}>
  <SiteHeader
    {tab}
    {staff}
    admin={adminRole}
    email={userEmail}
    locked={viewerWorkspace.locked}
    bind:theme
    {navigate}
    {login}
    logout={() => {
      supabase.auth.signOut();
    }}
  />
  <div class="notice">
    Consulta rutas, reconoce sus agarres y registra tu actividad.
  </div>
  {#if accessState === 'checking'}<p role="status" class="connection-status">
      Verificando sesión y permisos…
    </p>{:else if accessState === 'offline' || accessState === 'invalid'}<div
      class="connection-status"
      role="alert"
    >
      <strong
        >{accessState === 'invalid'
          ? 'Sesión inválida. Inicia sesión nuevamente.'
          : 'API no disponible. No se pudieron verificar tus permisos.'}</strong
      >
      <p>{accessError}</p>
      {#if accessState === 'invalid'}<button onclick={login}
          >Iniciar sesión para continuar</button
        >{/if}
      <button
        onclick={() => {
          refreshSession();
          refreshTwin();
          refreshRoutes();
        }}>Reintentar</button
      >
    </div>{:else if userEmail && accessState === 'confirmed'}<p
      class="connection-status"
    >
      Permisos confirmados · {adminRole
        ? 'Admin'
        : staff
          ? 'Staff'
          : 'Escalador'}
    </p>{/if}
</div>
<button
  class="drawer-toggle"
  hidden={!viewerWorkspace.active}
  disabled={viewerWorkspace.locked}
  aria-expanded={toolsOpen}
  aria-controls="tools-panel"
  onclick={() => (toolsOpen = !toolsOpen)}
  >{toolsOpen ? 'Plegar herramientas' : 'Abrir herramientas'}</button
>
{#if viewerWorkspace.active && tab === 'Catálogo' && show3D && !routePreparing}<button
    class="scene-exit"
    disabled={viewerWorkspace.locked}
    onclick={() => {
      show3D = false;
      toolsOpen = true;
    }}>Salir del 3D</button
  >{/if}
<div
  class="workspace"
  class:reading={!viewerWorkspace.active}
  class:tools-closed={!toolsOpen}
  onpointerdowncapture={(e) => {
    if (
      viewerWorkspace.locked &&
      !(e.target as HTMLElement).closest('[data-recording-control]')
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  }}
  onkeydowncapture={(e) => {
    if (
      viewerWorkspace.locked &&
      !(e.target as HTMLElement).closest('[data-recording-control]')
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  }}
>
  {#if viewerWorkspace.active}<div
      class="scene-backdrop"
      aria-hidden="true"
    ></div>{/if}
  <div bind:this={viewerHome} class="viewer-home">
    {#if viewerStarted}<SplatRuntime
        {...viewerWorkspace.active?.options ||
          viewerWorkspace.lastOptions || {
            capture: currentCapture,
            staff: false,
            routeId: 'gym-overview',
            onSave: () => {},
          }}
        visible={!!viewerWorkspace.active}
        onRecording={(active) => (viewerWorkspace.locked = active)}
        mount={placeViewer}
      />{/if}
  </div>
  <main
    id="tools-panel"
    class="tools-panel"
    aria-label="Contenido del gimnasio"
    tabindex="-1"
  >
    {#if tab === 'Inicio' || tab === 'El gimnasio'}<SitePublic
        view={tab}
        {navigate}
      />
    {:else if tab === 'Proyectos'}{#if userEmail && sessionReady}{#key userEmail}<ProjectsPanel
            routes={db.routes.filter((r) => r.status !== 'borrador')}
          />{/key}{:else}<p>Inicia sesión para consultar tus proyectos.</p>{/if}
    {:else if tab === 'Productos'}<StorePanel
      />{:else if tab === 'Recepción' && staff && sessionReady}<OperationsPanel
        admin={adminRole}
      />{:else if tab === 'Cuenta'}<h1 tabindex="-1">Mi cuenta</h1>
      {#if accountNotice}<p role="status">{accountNotice}</p>{/if}
      <p>
        Tu actividad y tus proyectos son privados. Las tarjetas solo incluyen
        los campos que selecciones antes de descargar.
      </p>
      {#if userEmail && sessionReady && location.pathname !== '/auth/reset-password'}<p
        >
          Sesión iniciada: {userEmail}
        </p>
        <label
          >Identificador de cuenta (UUID)<input
            readonly
            value={userId}
            aria-describedby="account-id-help"
          /></label
        >
        <p id="account-id-help">
          Usa este identificador para autorizar tu cuenta en el demo local. No
          es una contraseña ni concede permisos por sí solo.
        </p>
        <button onclick={() => navigate('Bitácora')}>Ver mi actividad</button
        >{:else}<AuthPanel
          onPasswordUpdated={() => (accountNotice = 'Contraseña actualizada.')}
        />{/if}{:else if tab === 'Capturas' && adminRole}<CaptureManager
        owner={userId}
        {currentCapture}
        routes={db.routes}
        onPublished={async () => {
          await refreshTwin();
          await refreshRoutes();
        }}
      />{:else if tab === 'Catálogo'}
      <div class="layout" class:route-detail={detailMode}>
        {#if !detailMode}<RouteCatalog
            routes={db.routes.filter((r) => r.status !== 'borrador')}
            {filtered}
            bind:query
            bind:grade
            bind:sectorFilter
            bind:scaleFilter
            bind:minGrade
            bind:maxGrade
            bind:order
            bind:showRetired
            {select}
            {clearFilters}
            loading={catalogLoading}
            loadError={catalogError}
            retry={() => {
              refreshRoutes();
            }}
          />{/if}
        {#if detailMode}
          <section aria-label="Ficha de ruta">
            {#if detailMode}<button onclick={() => navigate('Catálogo')}
                >Volver al catálogo</button
              >{/if}
            {#if routeError}<p role="alert">{routeError}</p>{:else if selected}
              <h2 tabindex="-1">
                {selected.name} <small>{selected.grade}</small>
              </h2>
              <p>
                {selected.sector} · Revisión {selected.revision} · {selected.status}
              </p>
              {#if selected.status === 'retirada'}<p role="status">
                  Ruta retirada. El enlace y su historial se conservan. Consulta
                  otras rutas en el catálogo.
                </p>{/if}
              <div class="actions">
                <button
                  class="primary"
                  onclick={() => {
                    measure('activity_start');
                    document
                      .getElementById('activity-form')
                      ?.scrollIntoView({ block: 'start' });
                  }}>Registrar actividad</button
                ><button
                  disabled={!userEmail ||
                    !sessionReady ||
                    projectBusy ||
                    selected.status === 'borrador'}
                  onclick={saveProject}>Guardar proyecto</button
                >
              </div>
              <RoutePresentation route={selected} />
              {#if selected.captureId}<button
                  id="explore-3d"
                  aria-expanded={show3D}
                  onclick={() => {
                    show3D = !show3D;
                    if (show3D) sceneStarted = performance.now();
                  }}>{show3D ? 'Seguir con imagen' : 'Explorar en 3D'}</button
                >{/if}
              {#if show3D && !routePreparing}<SplatViewer
                  capture={selectedCapture}
                  section={historicalSection ||
                    sections.find((s) => s.id === selected.sectionId)}
                  holds3D={selected.holds3D}
                  routeId={selected.id}
                  saved={selected.camera}
                  staff={false}
                  onReady={() => {
                    const key = `${selected?.id}:${selected?.revision}:${selectedCapture?.id}`;
                    if (lastSceneKey !== key) {
                      measure('scene_ready', performance.now() - sceneStarted);
                      lastSceneKey = key;
                    }
                  }}
                  onSave={() => {}}
                  exportInfo={{
                    title: selected.name,
                    grade: selected.grade,
                    gym: site.brand.attribution,
                    revision: selected.revision,
                    url: routeUrl(selected.id),
                  }}
                />{/if}
              {#if staff}{#key selected.id + ':' + selected.revision}<details>
                    <summary>Editar ruta</summary><RouteEditor
                      route={selected}
                      draft={editorPreparation(selected.id, selected.revision)}
                      owner={userId}
                      sourceRoutes={db.routes}
                      onDraft={(owner, id, revision, values) => {
                        if (owner === userId)
                          editorDrafts[`${owner}:${id}:${revision}`] = values;
                      }}
                      onPreparing={(active) => (routePreparing = active)}
                      onReload={() => refreshRoutes(selected?.id)}
                      onSaved={(id) => {
                        clearEditorPreparation(id);
                        refreshRoutes(id);
                      }}
                    />
                  </details>{/key}{/if}
              <details bind:open={betaOpen}>
                <summary>Ver beta</summary>
                <p>{selected.beta || 'El staff aún no ha añadido una beta.'}</p>
              </details>
              <details>
                <summary>Compartir</summary
                >{#if ['localhost', '127.0.0.1'].includes(location.hostname)}<p>
                    Enlace y QR locales: no accesibles desde internet.
                  </p>{/if}<button onclick={() => exportImage()}
                  >Preparar imagen de ruta</button
                ><a href={routeUrl(selected.id)}>Enlace de ruta</a>
                <details>
                  <summary>QR de la ruta</summary>{#if qr}<img
                      src={qr}
                      alt="QR del enlace a esta ruta"
                      width="220"
                      height="220"
                    /><button
                      onclick={() => download(qr, `${selectedId}-qr.png`)}
                      >Descargar QR</button
                    >{/if}
                  <p>
                    Destino: {routeUrl(selected.id)}. Comprueba que sea
                    accesible en los teléfonos del gimnasio antes de imprimir.
                  </p>
                </details>
                {#if shareOpen}<SharePreview
                    route={selected}
                    fields={shareFields}
                    {name}
                    gym={site.brand.attribution}
                  />{/if}
              </details>
              <form
                id="activity-form"
                aria-label="Registrar actividad"
                onsubmit={(e) => {
                  e.preventDefault();
                  record();
                }}
              >
                <h3>Registrar actividad</h3>
                <p>
                  {selected.name} · Revisión {selected.revision}. Los intentos
                  corresponden a esta actividad.
                </p>
                {#if draft.approvedRevision !== selected.revision}<p
                    role="alert"
                  >
                    La ruta tiene una revisión nueva. Revisa sus agarres y
                    reglas antes de enviar el borrador.
                  </p>
                  <button
                    type="button"
                    onclick={() =>
                      (draft.approvedRevision = selected!.revision)}
                    >Revisé la nueva revisión</button
                  >{/if}
                <label
                  >Intentos<input
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    aria-describedby={activityNotice
                      ? 'activity-result'
                      : undefined}
                    aria-invalid={activityError}
                    bind:value={draft.attempts}
                    required
                    disabled={recordingActivity}
                    oninput={() => (draft.activityKey = crypto.randomUUID())}
                  /></label
                >
                <label
                  >Resultado<select
                    bind:value={draft.result}
                    disabled={recordingActivity}
                    onchange={() => (draft.activityKey = crypto.randomUUID())}
                    ><option value="intento">Intento</option><option
                      value="ascenso">Ascenso</option
                    ></select
                  ></label
                >
                <label
                  >Notas<textarea
                    aria-describedby={activityNotice
                      ? 'activity-result'
                      : undefined}
                    bind:value={draft.notes}
                    maxlength="2000"
                    disabled={recordingActivity}
                    oninput={() => (draft.activityKey = crypto.randomUUID())}
                  ></textarea></label
                >
                <button
                  class="primary"
                  disabled={selected.status !== 'activa' ||
                    !userEmail ||
                    !sessionReady ||
                    recordingActivity ||
                    draft.approvedRevision !== selected.revision ||
                    savedActivity?.requestId === draft.activityKey}
                  >{recordingActivity
                    ? 'Guardando…'
                    : 'Guardar actividad'}</button
                >
                {#if !userEmail}<button type="button" onclick={login}
                    >Iniciar sesión para registrar</button
                  >{/if}
                {#if activityNotice}<p
                    id="activity-result"
                    class:error={activityError}
                    class="message"
                    role={activityError ? 'alert' : 'status'}
                  >
                    {activityNotice}
                  </p>{/if}
                {#if savedActivity?.requestId === draft.activityKey}<button
                    type="button"
                    onclick={() => {
                      const key = `${userId}:${selected!.id}:${selected!.revision}`;
                      drafts[key] = newDraft(selected!.revision);
                      savedActivity = undefined;
                      activityNotice = '';
                    }}>Registrar otra actividad</button
                  >{/if}
                {#if savedActivity?.routeId === selected.id && savedActivity.owner === userId}<button
                    type="button"
                    onclick={() => navigate('Bitácora')}>Ver registro</button
                  ><button
                    type="button"
                    disabled={recordingActivity}
                    onclick={undoRecord}>Deshacer</button
                  >{/if}
              </form>
              <details>
                <summary>Reportar un error</summary>
                <form
                  onsubmit={(e) => {
                    e.preventDefault();
                    sendReport();
                  }}
                >
                  <h3>Reportar un error</h3>
                  <p>{selected.name} · Revisión {selected.revision}</p>
                  <label
                    >Categoría<select
                      bind:value={draft.category}
                      disabled={reporting}
                      onchange={() => (draft.reportKey = crypto.randomUUID())}
                      ><option value="contenido">Contenido incorrecto</option
                      ><option value="agarre_suelto">Agarre suelto</option
                      ><option value="otro">Otro</option></select
                    ></label
                  >
                  {#if draft.category === 'agarre_suelto'}<p role="alert">
                      Avisa directamente al staff y evita usar ese agarre. El
                      reporte digital no garantiza atención inmediata.
                    </p>{/if}
                  <label
                    >Descripción<textarea
                      aria-describedby={reportNotice
                        ? 'report-result'
                        : undefined}
                      aria-invalid={reportError}
                      bind:value={draft.report}
                      required
                      maxlength="2000"
                      disabled={reporting}
                      oninput={() => (draft.reportKey = crypto.randomUUID())}
                    ></textarea></label
                  >
                  <button
                    disabled={!userEmail ||
                      !sessionReady ||
                      reporting ||
                      draft.approvedRevision !== selected.revision}
                    >{reporting ? 'Enviando…' : 'Enviar reporte'}</button
                  >
                  {#if reportNotice}<p
                      class="message"
                      id="report-result"
                      class:error={reportError}
                      role={reportError ? 'alert' : 'status'}
                    >
                      {reportNotice}
                    </p>{/if}
                </form>
              </details>
            {:else}<h2>
                {detailMode ? 'Buscando ruta…' : 'Selecciona una ruta'}
              </h2>
              <p>
                Consulta una ruta del catálogo para ver sus agarres y registrar
                actividad.
              </p>{/if}
          </section>{/if}
      </div>
    {:else if tab === 'Bitácora'}<h1>Mi bitácora</h1>
      {#if mediaEntry && userEmail && sessionReady}{#key mediaEntry.id}<HistoricalExport
            entry={mediaEntry}
            gym={site.brand.attribution}
            personal={sharedPersonal(mediaEntry, shareFields, name)}
            onClose={() => (mediaEntry = undefined)}
          />{/key}{/if}
      {#if userEmail && sessionReady}<ProjectsPanel routes={db.routes} />{/if}
      <button
        disabled={!userEmail || !sessionReady}
        onclick={() => {
          journalEntryOpen = true;
          editingEntry = undefined;
          retiringEntry = undefined;
          journalNotice = '';
        }}>Añadir registro</button
      >
      {#if journalNotice}<p role="status">{journalNotice}</p>{/if}
      {#if journalEntryOpen && userEmail && sessionReady}{#key editingEntry?.id || 'new-entry'}<JournalEntry
            entry={editingEntry}
            routes={db.routes}
            onCancel={() => (journalEntryOpen = false)}
            onSaved={async () => {
              const edited = !!editingEntry;
              await refreshSession();
              journalEntryOpen = false;
              editingEntry = undefined;
              journalNotice = edited
                ? 'Registro corregido; historial conservado.'
                : 'Registro añadido a tu bitácora.';
            }}
          />{/key}{/if}
      {#if retiringEntry && userEmail && sessionReady}<EntryRetirement
          entry={retiringEntry}
          onCancel={() => (retiringEntry = undefined)}
          onDone={async () => {
            await refreshSession();
            retiringEntry = undefined;
            journalNotice = 'Registro retirado de tu actividad vigente.';
          }}
        />{/if}
      {#if userEmail && sessionReady}{#key userEmail}<JournalControls
            onEntries={(entries) => (db.entries = entries)}
          />{/key}

        <fieldset>
          <legend>Campos de la tarjeta personal (privados por defecto)</legend>
          {#each [{ key: 'name', label: 'Nombre' }, { key: 'date', label: 'Fecha' }, { key: 'attempts', label: 'Intentos' }, { key: 'notes', label: 'Notas' }] as f}<label
              class="toggle"
              ><input
                type="checkbox"
                checked={shareFields[f.key as keyof typeof shareFields]}
                onchange={(e) =>
                  (shareFields[f.key as keyof typeof shareFields] =
                    e.currentTarget.checked)}
              />Incluir {f.label.toLowerCase()}</label
            >{/each}
          {#if shareFields.name}<label
              >Nombre para la tarjeta<input
                bind:value={name}
                maxlength="80"
              /></label
            >{/if}
        </fieldset>
        {#if shareOpen && shareEntry}<SharePreview
            entry={shareEntry}
            fields={shareFields}
            {name}
            gym={site.brand.attribution}
          />{/if}
        {#key userId}<MyReports />{/key}
        <DemoImport
          routes={db.routes}
          owner={userEmail}
          onImported={refreshSession}
        />
        {#each db.entries as entry (entry.id)}<article>
            <h2>{entry.routeName} · {entry.grade}</h2>
            <p>
              {entry.result === 'ascenso' ? 'Ascenso' : 'Intento'} · {entry.attempts}
              {entry.attempts === 1 ? 'intento' : 'intentos'} · {new Date(
                entry.date,
              ).toLocaleDateString('es-MX')}
            </p>
            <p>{entry.notes}</p>
            {#if entry.deletedAt}<p>
                Registro retirado · versión {entry.entryVersion || 1}
              </p>{:else}<div class="actions">
                <button
                  onclick={() => {
                    editingEntry = entry;
                    journalEntryOpen = true;
                    retiringEntry = undefined;
                    journalNotice = '';
                  }}>Corregir registro</button
                ><button
                  onclick={() => {
                    retiringEntry = entry;
                    journalEntryOpen = false;
                    journalNotice = '';
                  }}>Retirar registro</button
                >
              </div>{/if}
            <button
              onclick={() =>
                (historyEntryId = historyEntryId === entry.id ? '' : entry.id)}
              >Ver historial del registro</button
            >
            {#if historyEntryId === entry.id}{#key entry.id}<EntryHistory
                  entryId={entry.id}
                />{/key}{/if}
            {#if entry.result === 'ascenso' && !entry.deletedAt}<button
                onclick={() => exportImage(entry)}
                >Exportar tarjeta personal</button
              ><button onclick={() => (mediaEntry = entry)}
                >Preparar tarjeta histórica 3D</button
              >{/if}
          </article>{/each}
      {:else}<p>Inicia sesión para consultar tu bitácora personal.</p>{/if}
    {:else if tab === 'Staff' && staff}<h1>Panel del staff</h1>
      <PilotMetrics />
      <RouteEditor
        draft={editorDrafts[`${userId}:new:0`]}
        owner={userId}
        sourceRoutes={db.routes}
        onDraft={(owner, id, revision, values) => {
          if (owner === userId)
            editorDrafts[`${owner}:${id}:${revision}`] = values;
        }}
        onSaved={async (id) => {
          await refreshRoutes(id);
          navigate('Catálogo', id);
        }}
      />
      <h2>Rutas publicadas</h2>
      <p>
        Selecciona una ruta para consultar su ficha, editarla y revisar su
        historial.
      </p>
      <div class="route-list">
        {#each db.routes.filter((r) => r.status !== 'borrador') as r}<button
            onclick={() => select(r.id)}
            >{r.name} · {r.grade} · {r.status}</button
          >{/each}
      </div>
      <h2>Borradores de rutas</h2>
      {#each db.routes.filter((r) => r.status === 'borrador') as r}<button
          onclick={() => select(r.id)}
          >{r.name || 'Sin nombre'} · Borrador</button
        >{/each}
      <h2>Reportes</h2>
      {#each db.reports as r}<article>
          <strong
            >{db.routes.find((route) => route.id === r.routeId)?.name ||
              r.routeId}</strong
          >
          <p>{r.description}</p>
          <p>
            {r.status} · {r.category || 'contenido'} · Revisión {r.revision}
          </p>
          {#if r.resolution}<p>Resolución: {r.resolution}</p>{/if}
          {#if r.status === 'pendiente'}<p>
              {r.assignedTo
                ? r.assignedTo === userId
                  ? 'Asignado a ti'
                  : 'Asignado a otro integrante del staff'
                : 'Sin responsable'}
            </p>
            {#if !r.assignedTo}<button onclick={() => takeReport(r.id)}
                >Tomar reporte</button
              >{/if}<label
              >Motivo de resolución<textarea
                bind:value={resolutions[r.id]}
                maxlength="2000"></textarea></label
            ><button
              disabled={!resolutions[r.id]?.trim()}
              onclick={() => resolveReport(r.id)}>Marcar resuelto</button
            >{/if}
        </article>{/each}{#if !db.reports.length}<p>No hay reportes.</p>{/if}
    {:else}<p>
        Inicia sesión con una cuenta autorizada para consultar el panel.
      </p>{/if}
    {#if message}<p class="message error" role="alert">{message}</p>{/if}
  </main>
</div>

{#if !viewerWorkspace.active}<SiteFooter
    {navigate}
    locked={viewerWorkspace.locked}
  />{/if}
