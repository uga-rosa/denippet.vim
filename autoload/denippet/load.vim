function s:regex_builder(prefix) abort
  let patterns = []
  for p in a:prefix
    let chars = p->escape('\/?')->split('\zs')
    let chars_pattern = '\%(' . chars->join('\|') . '\)'
    call add(patterns, printf('%s%s\*', chars[0], chars_pattern))
  endfor
  return '\V\%(' . patterns->join('\|') . '\)\_$'
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
