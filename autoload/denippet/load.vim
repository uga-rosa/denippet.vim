function denippet#load#base() abort
  return line('$') == 1 && getline(1) =~# '\v^\k+$'
endfunction

function denippet#load#start() abort
  return getline('.')[:col('.')-2]
        \ ->match('\V\s\*\k\+\$') > -1
endfunction
