import { NextResponse } from 'next/server';
import { BucketError } from './bucket-shared';
export function bucketErrorResponse(error: unknown) {
  if (error instanceof BucketError) return NextResponse.json({error:error.message},{status:error.status});
  if (error instanceof SyntaxError) return NextResponse.json({error:'Invalid request body.'},{status:400});
  if (error instanceof Error && error.message==='Invalid request origin') return NextResponse.json({error:'Invalid request origin.'},{status:403});
  console.error('[bucket]', error instanceof Error ? error.message : 'Unknown error');
  return NextResponse.json({error:'Unable to update the bucket right now. Please try again.'},{status:503});
}
