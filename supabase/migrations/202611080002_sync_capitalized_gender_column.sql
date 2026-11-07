do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'allowed_emails'
      and column_name = 'Gender'
  ) then
    execute $migration$
      update public.allowed_emails
      set gender = lower(btrim("Gender"))
      where "Gender" is not null
        and lower(btrim("Gender")) in ('male', 'female')
    $migration$;
  end if;
end;
$$;
