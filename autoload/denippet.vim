" original code is from vim-vsnip
" https://github.com/hrsh7th/vim-vsnip/blob/7753ba9c10429c29d25abfd11b4c60b76718c438/autoload/vsnip/session.vim#L133-L149
" Copyright (c) 2019 hrsh7th
function denippet#select(range) abort
  const start = a:range.start
  const end = a:range.end
  let cmd = ''
  let cmd .= "\<Cmd>set virtualedit=onemore\<CR>"
  let cmd .= mode()[0] ==# 'i' ? "\<Esc>" : ''
  let cmd .= printf("\<Cmd>call cursor(%s, %s)\<CR>", start[0], start[1])
  let cmd .= 'v'
  let cmd .= printf("\<Cmd>call cursor(%s, %s)\<CR>%s", end[0], end[1], &selection ==# 'exclusive' ? '' : 'h')
  let cmd .= printf("\<Cmd>set virtualedit=%s\<CR>", &virtualedit)
  let cmd .= "\<C-g>"
  call feedkeys(cmd, 'ni')
endfunction
