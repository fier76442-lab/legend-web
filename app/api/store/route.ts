
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import fs from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'data', 'store.json');

const STAFF_ROLE_IDS = [
  '1562845546853441556', // Owner
  '1562845556337016952', // Co Owner
  '1562845563525926952', // Supervisor
  '1562845571662745601', // Server Manager
  '1562845567611310130', // Developer
  '1562845588637225123', // Head Admin
  '1562845634736824420', // Head Checker
  '1562845638884855818', // Head Whitelister
  '1562845660640841729', // Admin
  '1562875050971893900', // Trial Admin
  '1562845664042553477', // Moderator
  '1562874969162256490', // Trial Moderator
  '1562845668303704074', // PC Checker
  '1562845673311965354', // Whitelister
  '1562845680857251943', // Support Team
];

async function staff() {
  const secret = process.env.SESSION_SECRET;
  const cookie = (await cookies()).get('legend_discord_session')?.value;

  if (!secret || !cookie) {
    throw new Error('Sign in with Discord first.');
  }

  const { payload } = await jwtVerify(
    cookie,
    new TextEncoder().encode(secret)
  );

  const id = String(payload.discordId || '');
  const guild = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!id || !guild || !token) {
    throw new Error('Discord configuration is missing.');
  }

  const response = await fetch(
    `https://discord.com/api/v10/guilds/${guild}/members/${id}`,
    {
      headers: { Authorization: `Bot ${token}` },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    console.error('[STORE STAFF ACCESS] Discord API status:', response.status);

    if (response.status === 429) {
      throw new Error('Discord is rate-limiting requests. Please try again shortly.');
    }

    if (response.status === 404) {
      throw new Error('Your account is not in the configured Discord server.');
    }

    throw new Error('Could not verify Discord membership.');
  }

  const member = await response.json();
  const memberRoles: string[] = Array.isArray(member.roles)
    ? member.roles
    : [];

  const extraWhitelisterRole =
    process.env.DISCORD_WHITELISTER_ROLE_ID || '';

  const allowed =
    memberRoles.some((role) => STAFF_ROLE_IDS.includes(role)) ||
    (!!extraWhitelisterRole && memberRoles.includes(extraWhitelisterRole));

  if (!allowed) {
    throw new Error('Staff access required.');
  }
}

async function read() {
  try {
    const data = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET() {
  return NextResponse.json(
    { items: await read() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: Request) {
  try {
    await staff();

    const body = await req.json();
    const items = await read();

    const item = {
      id: crypto.randomUUID(),
      name: String(body.name || '').trim(),
      category: String(body.category || 'Cars'),
      description: String(body.description || ''),
      price: String(body.price || ''),
      image: String(body.image || ''),
    };

    if (
      item.image &&
      !(
        item.image.startsWith('/uploads/') ||
        /^https:\/\//i.test(item.image)
      )
    ) {
      return NextResponse.json(
        { message: 'Invalid image URL.' },
        { status: 400 }
      );
    }

    if (!item.name) {
      return NextResponse.json(
        { message: 'Vehicle name required.' },
        { status: 400 }
      );
    }

    items.push(item);

    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(items, null, 2));

    return NextResponse.json({ item });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Could not save store item.';

    const status = message === 'Staff access required.' ? 403
      : message.includes('Discord') || message.includes('Sign in') ? 403
      : 500;

    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    await staff();

    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { message: 'Store item ID required.' },
        { status: 400 }
      );
    }

    const items = (await read()).filter(
      (item: { id: string }) => item.id !== body.id
    );

    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(items, null, 2));

    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Could not delete item.';

    const status = message.includes('Discord') || message.includes('Sign in')
      ? 403
      : message === 'Staff access required.'
        ? 403
        : 500;

    return NextResponse.json({ message }, { status });
  }
}
