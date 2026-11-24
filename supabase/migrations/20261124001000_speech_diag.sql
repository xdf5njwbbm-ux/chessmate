-- What the device speech recognizer did during each browser attempt (events,
-- error code, whether the words came from a final or interim result, user
-- agent). Lets "we didn't catch anything" failures on phones be diagnosed.
alter table public.speech_attempts add column if not exists diag jsonb;

drop function if exists public.record_speech_attempt(text, text, text, jsonb, boolean, int);

create function public.record_speech_attempt(p_text text, p_ref text, p_recognized text, p_words jsonb,
                                             p_passed boolean, p_duration_ms int, p_diag jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_uid();
begin
  perform public.require_profile(v_uid);
  if (select count(*) from public.speech_attempts where user_id = v_uid and created_at > now() - interval '1 hour') >= 600 then
    raise exception 'You''ve practiced a lot this hour. Take a short break.' using errcode = '22023';
  end if;
  insert into public.speech_attempts (user_id, text, ref, provider, recognized, words, passed, duration_ms, diag)
  values (v_uid, left(btrim(p_text), 400), left(p_ref, 200), 'browser', left(coalesce(p_recognized, ''), 400),
          coalesce(p_words, '[]'::jsonb), coalesce(p_passed, false), greatest(0, least(120000, coalesce(p_duration_ms, 0))),
          case when p_diag is not null and pg_column_size(p_diag) <= 4000 then p_diag end);
  perform public.log_activity(v_uid, 'speaking', coalesce(p_passed, false), left(p_ref, 200));
  return jsonb_build_object('new_achievements', public.check_achievements(v_uid));
end
$$;

revoke execute on function public.record_speech_attempt(text, text, text, jsonb, boolean, int, jsonb) from public, anon;
grant execute on function public.record_speech_attempt(text, text, text, jsonb, boolean, int, jsonb) to authenticated;
