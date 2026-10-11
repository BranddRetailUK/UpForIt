import {describe,it,expect} from 'vitest';
import {submissionsAllowed,votingAllowed,cleanMixLink,validateMixDetails,csvCell,CompetitionSettings} from './mix-shared';
const settings:CompetitionSettings={submissions_open:true,voting_open:true,submissions_close_at:'2026-11-27T18:00:00.000Z',voting_close_at:'2026-11-27T18:00:00.000Z',announce_at:'2026-11-27T18:00:00.000Z',winner_entry_id:null};
describe('competition rules',()=>{
 it('closes submissions and votes at precisely 6pm UK on 27 November',()=>{
 const deadline=Date.parse(settings.voting_close_at);
 for(const allowed of [submissionsAllowed,votingAllowed]){expect(allowed(settings,deadline-1)).toBe(true);expect(allowed(settings,deadline)).toBe(false);expect(allowed(settings,deadline+1)).toBe(false);}
 expect(votingAllowed({...settings,voting_open:false},deadline-1)).toBe(false);
 expect(submissionsAllowed({...settings,submissions_open:false},deadline-1)).toBe(false);
 });
 it('accepts only public HTTPS SoundCloud hosts and removes tracking',()=>{
 expect(cleanMixLink('https://soundcloud.com/artist/mix?utm_source=test#x')).toBe('https://soundcloud.com/artist/mix');
 for(const url of ['http://soundcloud.com/a/b','https://soundcloud.com.evil.test/a/b','https://user:secret@soundcloud.com/a/b','https://localhost/a/b','https://soundcloud.com:123/a/b'])expect(()=>cleanMixLink(url)).toThrow();
 });
 it('validates required submission details',()=>{
 const input={artist:' DJ ',title:' Mix ',email:'DJ@EXAMPLE.COM',genre:'UKG',source:'Upload'};
 expect(validateMixDetails(input)).toMatchObject({artist:'DJ',title:'Mix',email:'dj@example.com'});
 for(const patch of [{artist:''},{title:''},{email:''},{genre:'Drum and Bass'},{source:'Other'}])expect(()=>validateMixDetails({...input,...patch})).toThrow();
 });
 it('escapes exported spreadsheet formulas and quoted names',()=>{expect(csvCell('=1+2')).toBe('"\'=1+2"');expect(csvCell('DJ "A"')).toBe('"DJ ""A"""');});
});
