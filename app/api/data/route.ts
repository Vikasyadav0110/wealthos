import { NextResponse } from 'next/server';
import { readDataStore, writeDataStore } from '@/lib/server/dataStore';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const data = await readDataStore();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error reading data store:', error);
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid data payload' }, { status: 400 });
    }
    
    await writeDataStore(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error writing data store:', error);
    return NextResponse.json({ error: 'Failed to write data' }, { status: 500 });
  }
}
