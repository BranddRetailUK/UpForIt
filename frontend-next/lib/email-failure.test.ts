import { describe, expect, it } from 'vitest';
import { classifyEmailSubmissionError, RejectedEmailSubmission } from './email-failure';
import { paymentReviewEmailHtml } from './email-templates';

describe('provider submission outcomes', () => {
  it.each([400,401,403,404,405,413,415,429])('recognises an explicit SDK HTTP %i rejection', code => {
    const error=Object.assign(new Error('Rejected'),{code,response:{body:{errors:[]}}});
    expect(classifyEmailSubmissionError(error)).toMatchObject({retryable:code===429});
    expect(classifyEmailSubmissionError(error)).toBeInstanceOf(RejectedEmailSubmission);
  });
  it.each([408,500,502,503,504])('does not blindly retry uncertain HTTP %i outcomes', code => {
    const error=Object.assign(new Error('Uncertain'),{code,response:{body:{}}});
    expect(classifyEmailSubmissionError(error)).toBe(error);
  });
  it('does not treat network or database errors as definite rejection',()=>{
    for(const error of [new Error('timeout'),Object.assign(new Error('database'),{code:429}),null]) expect(classifyEmailSubmissionError(error)).toBe(error);
  });
  it('explains review without claiming admission or a completed refund and escapes names',()=>{
    const html=paymentReviewEmailHtml({displayName:'<script>bad</script>',accountUrl:'https://example.com/account',siteUrl:'https://example.com'});
    expect(html).toContain('Please do not pay again');
    expect(html).toContain('does not confirm a refund');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('cid:');
  });
});
