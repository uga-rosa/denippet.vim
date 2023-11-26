" Copyright (c) 2019 hrsh7th
" Released under the MIT license
" https://github.com/hrsh7th/vim-vsnip/blob/7753ba9c10429c29d25abfd11b4c60b76718c438/LICENSE
" Original code is here
" https://github.com/hrsh7th/vim-vsnip/blob/7753ba9c10429c29d25abfd11b4c60b76718c438/autoload/vsnip/session.vim

function denippet#jump#move(position) abort
  let pos = [a:position.line + 1, a:position.character + 1]

  let eventignore = &eventignore
  let cmd = ''
  let cmd .= "\<Cmd>set eventignore=all\<CR>"
  if ['s', 'S', '']->index(mode()) >= 0
    let cmd .= "\<Esc>i"
  endif
  let cmd .= printf("\<Cmd>call cursor(%s, %s)\<CR>", pos[0], pos[1])
  let cmd .= printf("\<Cmd>set eventignore=%s\<CR>", eventignore)
  call feedkeys(cmd, 'ni')
endfunction

function denippet#jump#select(range) abort
  const start = [a:range.start.line + 1, a:range.start.character + 1]
  const end = [a:range.end.line + 1, a:range.end.character + 1]

  let virtualedit = &virtualedit
  let eventignore = &eventignore
  let cmd = ''
  let cmd .= "\<Cmd>set virtualedit=onemore\<CR>"
  let cmd .= "\<Cmd>set eventignore=all\<CR>"
  if ['i', 's', 'S', '']->index(mode()[0]) >= 0
    let cmd .= "\<Esc>"
  endif
  let cmd .= printf("\<Cmd>call cursor(%s, %s)\<CR>", start[0], start[1])
  let cmd .= 'v'
  let cmd .= printf("\<Cmd>call cursor(%s, %s)\<CR>", end[0], end[1])
  if &selection !=# 'exclusive'
    let cmd .= 'h'
  endif
  let cmd .= "\<C-g>"
  let cmd .= printf("\<Cmd>set virtualedit=%s\<CR>", virtualedit)
  let cmd .= printf("\<Cmd>set eventignore=%s\<CR>", eventignore)
  call feedkeys(cmd, 'ni')
endfunction
