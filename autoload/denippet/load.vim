function s:regex_builder(prefix) abort
  let regex = '\V\%('
  let fixed = []
  for p in a:prefix
    if p->len() > 1
      call add(fixed, strcharpart(p, 0, 1) . '\%[' . strcharpart(p, 1) . ']')
    else
      call add(fixed, p)
    endif
  endfor
  let regex .= fixed->join('\|')
  let regex .= '\)\_$'
  return regex
endfunction

function denippet#load#base(prefix) abort
  let pattern = '\v^' . s:regex_builder(a:prefix)
  let enabled = v:true
  let enabled = enabled && line('$') == 1
  let enabled = enabled && getline(1) =~# pattern
  return enabled
endfunction

function denippet#load#start(prefix) abort
  let line_before_cursor = getline('.')[:col('.')-2]
  let pattern = '\v^\s*' . s:regex_builder(a:prefix)
  return match(line_before_cursor, pattern) > -1
endfunction
