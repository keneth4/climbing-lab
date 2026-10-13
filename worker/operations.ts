import { body, json, text, HttpError } from './http';
const dateValid = (d: unknown) =>
  typeof d === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  Number.isFinite(Date.parse(d + 'T00:00:00.000Z')) &&
  new Date(d + 'T00:00:00.000Z').toISOString().slice(0, 10) === d;
const integer = (n: unknown, min = 0, max = 1_000_000_000) =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
function fields(b: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(b).some((k) => !allowed.includes(k)))
    throw new HttpError(400, 'Campo no permitido.');
}
export async function operationsApi(
  request: Request,
  env: Env,
  authenticate: () => Promise<string>,
): Promise<Response | undefined> {
  const url = new URL(request.url),
    path = url.pathname;
  if (
    !/^\/api\/(config|members|credentials|reception|visits|plans|memberships|payments|finance|products|variants|sales|inventory)(\/|$)/.test(
      path,
    )
  )
    return;
  if (
    [...url.searchParams.keys()].some(
      (k) => !['export', 'from', 'until'].includes(k),
    )
  )
    throw new HttpError(400, 'Parámetro no permitido.');
  const config = await env.DB.prepare(
    'SELECT * FROM gym_config WHERE id=1',
  ).first<{ name: string; currency: string; timezone: string }>();
  if (!config) throw new HttpError(503, 'Falta configuración del gimnasio.');
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  if (path === '/api/config' && request.method === 'GET')
    return json({ config });
  if (path === '/api/products' && request.method === 'GET') {
    const products = await env.DB.prepare(
      'SELECT v.*,p.name AS product_name FROM variants v JOIN products p ON p.id=v.product_id WHERE p.active=1 AND v.active=1 ORDER BY p.name,v.name LIMIT 1000',
    ).all();
    return json({ products: products.results, currency: config.currency });
  }
  const user = await authenticate();
  const role = await env.DB.prepare('SELECT role FROM staff WHERE user_id=?')
    .bind(user)
    .first<string>('role');
  const admin = () => {
    if (role !== 'admin') throw new HttpError(403, 'Sólo admin.');
  };
  const staff = () => {
    if (!role) throw new HttpError(403, 'Sólo staff.');
  };
  const now = new Date().toISOString();
  const referenceValue = (b: Record<string, unknown>) => {
    if (
      b.reference !== undefined &&
      (typeof b.reference !== 'string' || b.reference.length > 200)
    )
      throw new HttpError(400, 'Referencia inválida.');
    return typeof b.reference === 'string' ? b.reference : '';
  };

  const historyPath = path.match(
    /^\/api\/(payments|visits|variants|plans)\/([^/]+)\/history$/,
  );
  if (historyPath && request.method === 'GET') {
    if (historyPath[1] === 'visits') staff();
    else admin();
    const type = (
      {
        payments: 'payment',
        visits: 'visit',
        variants: 'variant',
        plans: 'plan',
      } as Record<string, string>
    )[historyPath[1]];
    const rows = await env.DB.prepare(
      'SELECT * FROM operation_history WHERE object_type=? AND object_id=? ORDER BY version DESC LIMIT 100',
    )
      .bind(type, historyPath[2])
      .all();
    return json({ history: rows.results });
  }

  if (path === '/api/inventory' && request.method === 'GET') {
    admin();
    return json({
      products: (
        await env.DB.prepare(
          'SELECT v.*,p.name AS product_name FROM variants v JOIN products p ON p.id=v.product_id ORDER BY p.name,v.name LIMIT 1000',
        ).all()
      ).results,
      currency: config.currency,
    });
  }

  async function batch(
    type: string,
    id: string,
    version: number,
    snapshot: unknown,
    statements: D1PreparedStatement[],
    action: string,
  ) {
    if (type === 'payment') {
      const currencyGuard = guard(
        'SELECT CASE WHEN currency=? THEN 1 ELSE 0 END FROM gym_config WHERE id=1',
        [config!.currency],
      );
      statements.unshift(currencyGuard.begin);
      statements.push(currencyGuard.end);
    }
    statements.push(
      env.DB.prepare('INSERT INTO operation_history VALUES(?,?,?,?,?,?)').bind(
        type,
        id,
        version,
        JSON.stringify(snapshot),
        user,
        now,
      ),
      env.DB.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(
        crypto.randomUUID(),
        user,
        action,
        id,
        now,
      ),
    );
    try {
      await env.DB.batch(statements);
    } catch {
      throw new HttpError(
        409,
        'La operación cambió, está duplicada o no tiene saldo suficiente. Recarga.',
      );
    }
  }
  const guard = (sql: string, params: (string | number)[]) => {
    const id = crypto.randomUUID();
    return {
      begin: env.DB.prepare(
        `INSERT INTO mutation_guards(id,verified) VALUES(?,COALESCE((${sql}),0))`,
      ).bind(id, ...params),
      end: env.DB.prepare('DELETE FROM mutation_guards WHERE id=?').bind(id),
    };
  };
  if (path === '/api/config' && request.method === 'PUT') {
    admin();
    const b = await body(request);
    fields(b, ['name', 'currency', 'timezone']);
    const name = text(b.name, 100),
      currency = text(b.currency, 3),
      timezone = text(b.timezone, 100);
    if (!/^[A-Z]{3}$/.test(currency))
      throw new HttpError(400, 'Moneda inválida.');
    try {
      new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format();
    } catch {
      throw new HttpError(400, 'Zona horaria inválida.');
    }
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM payments',
    ).first<number>('n');
    if (count && currency !== config.currency)
      throw new HttpError(
        409,
        'No se puede cambiar moneda con cobros existentes.',
      );
    const g = guard(
      'SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM payments) OR ?=(SELECT currency FROM gym_config WHERE id=1) THEN 1 ELSE 0 END',
      [currency],
    );
    await env.DB.batch([
      g.begin,
      env.DB.prepare(
        'UPDATE gym_config SET name=?,currency=?,timezone=? WHERE id=1',
      ).bind(name, currency, timezone),
      env.DB.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(
        crypto.randomUUID(),
        user,
        'config.updated',
        '1',
        now,
      ),
      g.end,
    ]);
    return json({ ok: true });
  }
  if (path === '/api/members/me') {
    if (request.method === 'GET')
      return json({
        member: await env.DB.prepare('SELECT * FROM members WHERE user_id=?')
          .bind(user)
          .first(),
      });
    if (request.method === 'POST') {
      const b = await body(request);
      fields(b, ['name']);
      const id = crypto.randomUUID(),
        name = text(b.name, 100);
      await batch(
        'member',
        id,
        1,
        { id, name },
        [
          env.DB.prepare(
            'INSERT INTO members(id,user_id,name,created_at) VALUES(?,?,?,?)',
          ).bind(id, user, name, now),
        ],
        'member.created',
      );
      return json({ id }, 201);
    }
  }
  if (path === '/api/members') {
    staff();
    if (request.method === 'GET') {
      const members = await env.DB.prepare(
        'SELECT id,name,version FROM members ORDER BY name,id LIMIT 3000',
      ).all();
      return json({ members: members.results });
    }
    if (request.method === 'POST') {
      const b = await body(request);
      fields(b, ['name']);
      const id = crypto.randomUUID(),
        name = text(b.name, 100);
      await batch(
        'member',
        id,
        1,
        { id, name },
        [
          env.DB.prepare(
            'INSERT INTO members(id,name,created_at) VALUES(?,?,?)',
          ).bind(id, name, now),
        ],
        'member.created',
      );
      return json({ id }, 201);
    }
  }
  if (path === '/api/credentials' && request.method === 'POST') {
    staff();
    const b = await body(request);
    fields(b, ['memberId']);
    const memberId = text(b.memberId, 100);
    if (
      !(await env.DB.prepare('SELECT id FROM members WHERE id=?')
        .bind(memberId)
        .first())
    )
      throw new HttpError(404, 'Socio no encontrado.');
    const id = crypto.randomUUID(),
      token = crypto.randomUUID() + crypto.randomUUID(),
      digest = await hash(token);
    await batch(
      'credential',
      id,
      1,
      { id, memberId },
      [
        env.DB.prepare(
          'UPDATE credentials SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL',
        ).bind(now, memberId),
        env.DB.prepare('INSERT INTO credentials VALUES(?,?,?,?,?)').bind(
          id,
          memberId,
          digest,
          null,
          now,
        ),
      ],
      'credential.issued',
    );
    return json({ id, token }, 201);
  }
  const revoke = path.match(/^\/api\/credentials\/([^/]+)\/revoke$/);
  if (revoke && request.method === 'POST') {
    staff();
    const g = guard(
      'SELECT CASE WHEN revoked_at IS NULL THEN 1 ELSE 0 END FROM credentials WHERE id=?',
      [revoke[1]],
    );
    await batch(
      'credential',
      revoke[1],
      2,
      { revoked: true },
      [
        g.begin,
        env.DB.prepare('UPDATE credentials SET revoked_at=? WHERE id=?').bind(
          now,
          revoke[1],
        ),
        g.end,
      ],
      'credential.revoked',
    );
    return json({ ok: true });
  }
  if (path === '/api/reception/resolve' && request.method === 'POST') {
    staff();
    const b = await body(request);
    fields(b, ['token']);
    const token = text(b.token, 200),
      credential = await env.DB.prepare(
        'SELECT c.id,c.member_id,m.name FROM credentials c JOIN members m ON m.id=c.member_id WHERE c.token_hash=? AND c.revoked_at IS NULL',
      )
        .bind(await hash(token))
        .first<{ id: string; member_id: string; name: string }>();
    if (!credential)
      throw new HttpError(404, 'Credencial inválida o revocada.');
    const memberships = await env.DB.prepare(
      "SELECT * FROM memberships WHERE member_id=? AND status='active' ORDER BY end_day,id",
    )
      .bind(credential.member_id)
      .all();
    const visit = await env.DB.prepare(
      'SELECT * FROM visits WHERE member_id=? AND day=?',
    )
      .bind(credential.member_id, today)
      .first();
    return json({ credential, memberships: memberships.results, visit, today });
  }
  if (path === '/api/visits' && request.method === 'GET') {
    staff();
    const visits = await env.DB.prepare(
      'SELECT v.*,m.name FROM visits v JOIN members m ON m.id=v.member_id ORDER BY v.created_at DESC LIMIT 1000',
    ).all();
    return json({ visits: visits.results });
  }
  if (path === '/api/visits' && request.method === 'POST') {
    staff();
    const b = await body(request);
    fields(b, ['credentialId', 'membershipId', 'consume']);
    const credentialId = text(b.credentialId, 100),
      credential = await env.DB.prepare(
        'SELECT * FROM credentials WHERE id=? AND revoked_at IS NULL',
      )
        .bind(credentialId)
        .first<{ member_id: string }>();
    if (!credential) throw new HttpError(404, 'Credencial revocada.');
    const existing = await env.DB.prepare(
      'SELECT * FROM visits WHERE member_id=? AND day=?',
    )
      .bind(credential.member_id, today)
      .first();
    if (existing) return json({ visit: existing, duplicate: true });
    if (typeof b.consume !== 'boolean')
      throw new HttpError(400, 'Confirma el consumo de entrada.');
    const membershipId = b.membershipId ? text(b.membershipId, 100) : null;
    let membership: any;
    if (membershipId) {
      membership = await env.DB.prepare(
        "SELECT * FROM memberships WHERE id=? AND member_id=? AND status='active' AND start_day<=? AND end_day>=?",
      )
        .bind(membershipId, credential.member_id, today, today)
        .first();
      if (!membership) throw new HttpError(400, 'Membresía fuera de vigencia.');
    }
    if (
      b.consume &&
      (!membership || membership.kind !== 'entries' || membership.remaining < 1)
    )
      throw new HttpError(400, 'No hay entrada disponible.');
    if (membership?.kind === 'entries' && !b.consume)
      throw new HttpError(400, 'Confirma consumo para usar el bono.');
    const id = crypto.randomUUID(),
      g = guard(
        'SELECT CASE WHEN revoked_at IS NULL THEN 1 ELSE 0 END FROM credentials WHERE id=?',
        [credentialId],
      );
    const statements = [
      g.begin,
      env.DB.prepare(
        'INSERT INTO visits(id,member_id,credential_id,membership_id,day,consumed,status,actor,created_at,version) VALUES(?,?,?,?,?,?,?,?,?,?)',
      ).bind(
        id,
        credential.member_id,
        credentialId,
        membershipId,
        today,
        b.consume ? 1 : 0,
        'confirmed',
        user,
        now,
        1,
      ),
    ];
    if (membership) {
      const mg = guard(
        "SELECT CASE WHEN status='active' AND version=? AND start_day<=? AND end_day>=? AND (?=0 OR remaining>0) THEN 1 ELSE 0 END FROM memberships WHERE id=?",
        [membership.version, today, today, b.consume ? 1 : 0, membershipId!],
      );
      statements.push(mg.begin);
      if (b.consume)
        statements.push(
          env.DB.prepare(
            'UPDATE memberships SET remaining=remaining-1,version=version+1 WHERE id=?',
          ).bind(membershipId),
        );
      statements.push(mg.end);
    }
    statements.push(g.end);
    await batch(
      'visit',
      id,
      1,
      { credentialId, membershipId, consumed: b.consume, day: today },
      statements,
      'visit.confirmed',
    );
    return json({ id }, 201);
  }
  const voidVisit = path.match(/^\/api\/visits\/([^/]+)\/void$/);
  if (voidVisit && request.method === 'POST') {
    staff();
    const b = await body(request);
    fields(b, ['expectedVersion', 'reason']);
    const reason = text(b.reason, 500),
      visit = await env.DB.prepare('SELECT * FROM visits WHERE id=?')
        .bind(voidVisit[1])
        .first<any>();
    if (!visit) throw new HttpError(404, 'Visita no encontrada.');
    if (visit.status !== 'confirmed' || visit.version !== b.expectedVersion)
      throw new HttpError(409, 'Visita ya corregida.');
    const g = guard(
      "SELECT CASE WHEN status='confirmed' AND version=? THEN 1 ELSE 0 END FROM visits WHERE id=?",
      [visit.version, visit.id],
    );
    const statements = [
      g.begin,
      env.DB.prepare(
        "UPDATE visits SET status='voided',version=version+1 WHERE id=?",
      ).bind(visit.id),
    ];
    if (visit.consumed)
      statements.push(
        env.DB.prepare(
          'UPDATE memberships SET remaining=remaining+1,version=version+1 WHERE id=?',
        ).bind(visit.membership_id),
      );
    statements.push(g.end);
    await batch(
      'visit',
      visit.id,
      visit.version + 1,
      { ...visit, status: 'voided', version: visit.version + 1, reason },
      statements,
      'visit.voided',
    );
    return json({ ok: true });
  }
  if (path === '/api/plans') {
    admin();
    if (request.method === 'GET')
      return json({
        plans: (
          await env.DB.prepare(
            'SELECT * FROM plans ORDER BY name,id LIMIT 1000',
          ).all()
        ).results,
      });
    if (request.method === 'POST') {
      const b = await body(request);
      fields(b, ['name', 'kind', 'quantity', 'price']);
      if (
        !['period', 'entries'].includes(String(b.kind)) ||
        !integer(b.quantity, 1, 366) ||
        !integer(b.price)
      )
        throw new HttpError(400, 'Plan inválido.');
      const id = crypto.randomUUID(),
        name = text(b.name, 100);
      await batch(
        'plan',
        id,
        1,
        { ...b, id },
        [
          env.DB.prepare(
            'INSERT INTO plans(id,name,kind,quantity,price) VALUES(?,?,?,?,?)',
          ).bind(id, name, b.kind, b.quantity, b.price),
        ],
        'plan.created',
      );
      return json({ id }, 201);
    }
  }
  const planPath = path.match(/^\/api\/plans\/([^/]+)$/);
  if (planPath && request.method === 'PUT') {
    admin();
    const b = await body(request);
    fields(b, ['expectedVersion', 'name', 'price', 'active']);
    if (!integer(b.price) || typeof b.active !== 'boolean')
      throw new HttpError(400, 'Plan inválido.');
    const name = text(b.name, 100),
      g = guard(
        'SELECT CASE WHEN version=? THEN 1 ELSE 0 END FROM plans WHERE id=?',
        [Number(b.expectedVersion), planPath[1]],
      );
    await batch(
      'plan',
      planPath[1],
      Number(b.expectedVersion) + 1,
      b,
      [
        g.begin,
        env.DB.prepare(
          'UPDATE plans SET name=?,price=?,active=?,version=version+1 WHERE id=?',
        ).bind(name, b.price, b.active ? 1 : 0, planPath[1]),
        g.end,
      ],
      'plan.updated',
    );
    return json({ ok: true });
  }
  if (path === '/api/memberships' && request.method === 'GET') {
    admin();
    return json({
      memberships: (
        await env.DB.prepare(
          'SELECT ms.*,m.name FROM memberships ms JOIN members m ON m.id=ms.member_id ORDER BY end_day DESC LIMIT 3000',
        ).all()
      ).results,
    });
  }
  if (path === '/api/payments' && request.method === 'POST') {
    admin();
    const b = await body(request);
    fields(b, [
      'memberId',
      'planId',
      'startDay',
      'endDay',
      'method',
      'reference',
    ]);
    const memberId = text(b.memberId, 100),
      planId = text(b.planId, 100),
      method = String(b.method);
    if (
      !['cash', 'transfer', 'terminal'].includes(method) ||
      !dateValid(b.startDay)
    )
      throw new HttpError(400, 'Cobro inválido.');
    const plan = await env.DB.prepare(
      'SELECT * FROM plans WHERE id=? AND active=1',
    )
      .bind(planId)
      .first<any>();
    if (!plan) throw new HttpError(404, 'Plan no disponible.');
    const startDay = String(b.startDay);
    let endDay: string;
    if (plan.kind === 'period') {
      const d = new Date(startDay + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + plan.quantity - 1);
      endDay = d.toISOString().slice(0, 10);
    } else {
      if (!dateValid(b.endDay) || String(b.endDay) < startDay)
        throw new HttpError(400, 'Vigencia del bono inválida.');
      endDay = String(b.endDay);
    }
    const id = crypto.randomUUID(),
      membershipId = crypto.randomUUID();
    const g = guard(
      'SELECT CASE WHEN active=1 AND version=? THEN 1 ELSE 0 END FROM plans WHERE id=?',
      [plan.version, planId],
    );
    await batch(
      'payment',
      id,
      1,
      { ...b, amount: plan.price, membershipId, status: 'pending' },
      [
        g.begin,
        env.DB.prepare(
          'INSERT INTO memberships VALUES(?,?,?,?,?,?,?,?,?,?)',
        ).bind(
          membershipId,
          memberId,
          planId,
          plan.kind,
          startDay,
          endDay,
          plan.kind === 'entries' ? plan.quantity : 0,
          plan.kind === 'entries' ? plan.quantity : 0,
          'pending',
          1,
        ),
        env.DB.prepare(
          'INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        ).bind(
          id,
          'membership',
          membershipId,
          plan.price,
          config.currency,
          method,
          'pending',
          referenceValue(b),
          user,
          now,
          null,
          1,
        ),
        g.end,
      ],
      'payment.created',
    );
    return json({ id, membershipId }, 201);
  }
  if (path === '/api/products' && request.method === 'POST') {
    admin();
    const b = await body(request);
    fields(b, ['name', 'variant', 'sku', 'price', 'stock']);
    if (!integer(b.price) || !integer(b.stock, 0, 100000))
      throw new HttpError(400, 'Precio/stock inválido.');
    const id = crypto.randomUUID(),
      variantId = crypto.randomUUID(),
      name = text(b.name, 100),
      variant = text(b.variant, 100),
      sku = text(b.sku, 100);
    await batch(
      'variant',
      variantId,
      1,
      { name, variant, sku, price: b.price, stock: b.stock },
      [
        env.DB.prepare('INSERT INTO products(id,name) VALUES(?,?)').bind(
          id,
          name,
        ),
        env.DB.prepare(
          'INSERT INTO variants(id,product_id,name,sku,price,stock) VALUES(?,?,?,?,?,?)',
        ).bind(variantId, id, variant, sku, b.price, b.stock),
      ],
      'product.created',
    );
    return json({ id, variantId }, 201);
  }
  if (path === '/api/variants' && request.method === 'POST') {
    admin();
    const b = await body(request);
    fields(b, ['productId', 'name', 'sku', 'price', 'stock']);
    if (!integer(b.price) || !integer(b.stock, 0, 100000))
      throw new HttpError(400, 'Precio/stock inválido.');
    const productId = text(b.productId, 100),
      name = text(b.name, 100),
      sku = text(b.sku, 100),
      id = crypto.randomUUID();
    const g = guard(
      'SELECT CASE WHEN active=1 THEN 1 ELSE 0 END FROM products WHERE id=?',
      [productId],
    );
    await batch(
      'variant',
      id,
      1,
      b,
      [
        g.begin,
        env.DB.prepare(
          'INSERT INTO variants(id,product_id,name,sku,price,stock) VALUES(?,?,?,?,?,?)',
        ).bind(id, productId, name, sku, b.price, b.stock),
        g.end,
      ],
      'variant.created',
    );
    return json({ id }, 201);
  }
  const variantPath = path.match(/^\/api\/variants\/([^/]+)$/);
  if (variantPath && request.method === 'PUT') {
    admin();
    const b = await body(request);
    fields(b, ['expectedVersion', 'price', 'stock', 'active', 'reason']);
    if (
      !integer(b.price) ||
      !integer(b.stock, 0, 100000) ||
      typeof b.active !== 'boolean'
    )
      throw new HttpError(400, 'Inventario inválido.');
    const reason = text(b.reason, 500),
      g = guard(
        'SELECT CASE WHEN version=? THEN 1 ELSE 0 END FROM variants WHERE id=?',
        [Number(b.expectedVersion), variantPath[1]],
      );
    await batch(
      'variant',
      variantPath[1],
      Number(b.expectedVersion) + 1,
      b,
      [
        g.begin,
        env.DB.prepare(
          'UPDATE variants SET price=?,stock=?,active=?,version=version+1 WHERE id=?',
        ).bind(b.price, b.stock, b.active ? 1 : 0, variantPath[1]),
        g.end,
      ],
      'variant.adjusted',
    );
    return json({ ok: true, reason });
  }
  if (path === '/api/sales' && request.method === 'GET') {
    admin();
    const sales = await env.DB.prepare(
      "SELECT s.*,p.id AS payment_id,p.amount,p.method,p.reference,p.version AS payment_version FROM sales s JOIN payments p ON p.source_type='sale' AND p.source_id=s.id ORDER BY s.created_at DESC LIMIT 1000",
    ).all();
    return json({ sales: sales.results });
  }
  if (path === '/api/sales' && request.method === 'POST') {
    admin();
    const b = await body(request);
    fields(b, ['memberId', 'lines', 'method', 'reference']);
    if (
      !['cash', 'transfer', 'terminal'].includes(String(b.method)) ||
      !Array.isArray(b.lines) ||
      !b.lines.length ||
      b.lines.length > 50
    )
      throw new HttpError(400, 'Venta inválida.');
    const lines: {
        id: string;
        quantity: number;
        price: number;
        name: string;
        version: number;
      }[] = [],
      ids = new Set<string>();
    let total = 0;
    for (const raw of b.lines) {
      if (!raw || typeof raw !== 'object')
        throw new HttpError(400, 'Línea inválida.');
      fields(raw, ['variantId', 'quantity']);
      const variantId = text(raw.variantId, 100);
      if (ids.has(variantId) || !integer(raw.quantity, 1, 10000))
        throw new HttpError(400, 'Línea duplicada o cantidad inválida.');
      ids.add(variantId);
      const v = await env.DB.prepare(
        'SELECT v.*,p.name AS product_name FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND v.active=1 AND p.active=1',
      )
        .bind(variantId)
        .first<any>();
      if (!v) throw new HttpError(404, 'Producto no disponible.');
      total += v.price * raw.quantity;
      lines.push({
        id: variantId,
        quantity: raw.quantity,
        price: v.price,
        name: `${v.product_name} · ${v.name}`,
        version: v.version,
      });
    }
    if (!integer(total)) throw new HttpError(400, 'Importe fuera de rango.');
    const id = crypto.randomUUID(),
      paymentId = crypto.randomUUID();
    const statements = [
      env.DB.prepare('INSERT INTO sales VALUES(?,?,?,?)').bind(
        id,
        b.memberId ? text(b.memberId, 100) : null,
        'pending',
        now,
      ),
    ];
    for (const l of lines) {
      const g = guard(
        'SELECT CASE WHEN version=? AND active=1 THEN 1 ELSE 0 END FROM variants WHERE id=?',
        [l.version, l.id],
      );
      statements.push(
        g.begin,
        env.DB.prepare('INSERT INTO sale_lines VALUES(?,?,?,?,?)').bind(
          id,
          l.id,
          l.name,
          l.quantity,
          l.price,
        ),
        g.end,
      );
    }
    statements.push(
      env.DB.prepare(
        'INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
      ).bind(
        paymentId,
        'sale',
        id,
        total,
        config.currency,
        b.method,
        'pending',
        referenceValue(b),
        user,
        now,
        null,
        1,
      ),
    );
    await batch(
      'payment',
      paymentId,
      1,
      { source: 'sale', saleId: id, amount: total, lines, status: 'pending' },
      statements,
      'sale.created',
    );
    return json({ id, paymentId }, 201);
  }
  const paymentPath = path.match(/^\/api\/payments\/([^/]+)\/(confirm|void)$/);
  if (paymentPath && request.method === 'POST') {
    admin();
    const b = await body(request);
    fields(b, ['expectedVersion', 'reason']);
    const p = await env.DB.prepare('SELECT * FROM payments WHERE id=?')
      .bind(paymentPath[1])
      .first<any>();
    if (!p) throw new HttpError(404, 'Cobro no encontrado.');
    const confirming = paymentPath[2] === 'confirm';
    if (
      p.version !== b.expectedVersion ||
      p.status === 'voided' ||
      (confirming && p.status !== 'pending')
    )
      throw new HttpError(409, 'Cobro ya procesado.');
    const reason = confirming ? 'Confirmación manual' : text(b.reason, 500);
    const g = guard(
      'SELECT CASE WHEN version=? AND status=? THEN 1 ELSE 0 END FROM payments WHERE id=?',
      [p.version, p.status, p.id],
    );
    const statements = [g.begin];
    if (p.source_type === 'membership')
      statements.push(
        env.DB.prepare(
          'UPDATE memberships SET status=?,version=version+1 WHERE id=?',
        ).bind(confirming ? 'active' : 'revoked', p.source_id),
      );
    else {
      const lines = await env.DB.prepare(
        'SELECT * FROM sale_lines WHERE sale_id=?',
      )
        .bind(p.source_id)
        .all<any>();
      if (confirming)
        for (const l of lines.results) {
          const sg = guard(
            'SELECT CASE WHEN stock>=? AND active=1 THEN 1 ELSE 0 END FROM variants WHERE id=?',
            [l.quantity, l.variant_id],
          );
          statements.push(
            sg.begin,
            env.DB.prepare(
              'UPDATE variants SET stock=stock-?,version=version+1 WHERE id=?',
            ).bind(l.quantity, l.variant_id),
            sg.end,
          );
        }
      else if (p.status === 'confirmed')
        for (const l of lines.results)
          statements.push(
            env.DB.prepare(
              'UPDATE variants SET stock=stock+?,version=version+1 WHERE id=?',
            ).bind(l.quantity, l.variant_id),
          );
      statements.push(
        env.DB.prepare('UPDATE sales SET status=? WHERE id=?').bind(
          confirming ? 'confirmed' : 'voided',
          p.source_id,
        ),
      );
    }
    statements.push(
      env.DB.prepare(
        'UPDATE payments SET status=?,confirmed_at=?,version=version+1 WHERE id=?',
      ).bind(
        confirming ? 'confirmed' : 'voided',
        confirming ? now : p.confirmed_at,
        p.id,
      ),
      g.end,
    );
    await batch(
      'payment',
      p.id,
      p.version + 1,
      { ...p, status: confirming ? 'confirmed' : 'voided', reason },
      statements,
      confirming ? 'payment.confirmed' : 'payment.voided',
    );
    return json({ ok: true });
  }
  if (
    (path === '/api/payments' || path === '/api/finance') &&
    request.method === 'GET'
  ) {
    admin();
    const from = url.searchParams.get('from'),
      until = url.searchParams.get('until');
    if (
      (from && !dateValid(from)) ||
      (until && !dateValid(until)) ||
      (from && until && from > until)
    )
      throw new HttpError(400, 'Fechas UTC inválidas.');
    const where = ['1=1'],
      params: string[] = [];
    if (from) {
      where.push('created_at>=?');
      params.push(from + 'T00:00:00.000Z');
    }
    if (until) {
      where.push('created_at<?');
      const d = new Date(until + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      params.push(d.toISOString());
    }
    const payments = await env.DB.prepare(
      `SELECT * FROM payments WHERE ${where.join(' AND ')} ORDER BY created_at DESC,id LIMIT 2001`,
    )
      .bind(...params)
      .all<any>();
    if (payments.results.length > 2000)
      throw new HttpError(
        400,
        'Acota fechas a 2000 movimientos. No se devuelve un total parcial.',
      );
    const totals = {
      confirmed: 0,
      pending: 0,
      voided: 0,
      confirmedCount: 0,
      methods: { cash: 0, transfer: 0, terminal: 0 },
      membership: 0,
      sales: 0,
    };
    for (const p of payments.results) {
      totals[p.status as 'confirmed' | 'pending' | 'voided'] += p.amount;
      if (p.status === 'confirmed') {
        totals.confirmedCount++;
        totals.methods[p.method as 'cash' | 'transfer' | 'terminal'] +=
          p.amount;
        if (p.source_type === 'sale') totals.sales += p.amount;
        else totals.membership += p.amount;
      }
    }
    if (url.searchParams.has('export')) {
      if (url.searchParams.get('export') !== 'csv')
        throw new HttpError(400, 'Formato inválido.');
      const cell = (v: unknown) => {
        let s = String(v ?? '');
        if (/^\s*[=+\-@]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      const rows = [
        [
          'ID',
          'Origen',
          'Importe centavos',
          'Moneda',
          'Método',
          'Estado',
          'Referencia',
          'Fecha UTC',
          'Responsable',
        ],
        ...payments.results.map((p) => [
          p.id,
          p.source_type,
          p.amount,
          p.currency,
          p.method,
          p.status,
          p.reference,
          p.created_at,
          p.actor,
        ]),
      ];
      return json({
        csv: '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n'),
        records: payments.results.length,
      });
    }
    const memberships = await env.DB.prepare(
      "SELECT COUNT(*) AS active FROM memberships WHERE status='active' AND start_day<=? AND end_day>=? AND (kind='period' OR remaining>0)",
    )
      .bind(today, today)
      .first();
    return json({
      payments: payments.results,
      totals,
      memberships,
      currency: config.currency,
    });
  }
  throw new HttpError(404, 'Operación no encontrada.');
}
