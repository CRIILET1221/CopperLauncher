!include LogicLib.nsh

!ifdef MAINBINARYNAME
  !define COPPER_MAIN_EXE "${MAINBINARYNAME}.exe"
!else
  !define COPPER_MAIN_EXE "copper-launcher.exe"
!endif

!define COPPER_ASIDE ".copper-old"

Var CopperAttempt
Var CopperProbe
Var CopperAside
Var CopperExitCode

; NSIS aborts the install with "Error opening file for writing" whenever the
; target is still held: the app running from the tray, an elevated instance the
; per-user installer may not terminate, a virus scanner reading the previous
; build, or a read-only attribute left by one of them. Retrying opens the same
; handle and fails again, so the file is freed here instead: attributes cleared,
; the app asked to quit, then forced, and as a last resort the locked file is
; renamed aside — Windows allows renaming a running image — and removed on the
; next reboot. The installer writes a fresh binary either way.
!macro CopperFreeFile _file
  ${If} ${FileExists} "${_file}"
    SetFileAttributes "${_file}" NORMAL
    StrCpy $CopperAttempt 0
    ${Do}
      ClearErrors
      FileOpen $CopperProbe "${_file}" a
      ${IfNot} ${Errors}
        FileClose $CopperProbe
        ${Break}
      ${EndIf}
      ${If} $CopperAttempt == 0
        nsExec::Exec 'taskkill /IM "${COPPER_MAIN_EXE}"'
        Pop $CopperExitCode
      ${ElseIf} $CopperAttempt == 2
        nsExec::Exec 'taskkill /F /IM "${COPPER_MAIN_EXE}"'
        Pop $CopperExitCode
      ${ElseIf} $CopperAttempt == 4
        StrCpy $CopperAside "${_file}${COPPER_ASIDE}"
        Delete "$CopperAside"
        ClearErrors
        Rename "${_file}" "$CopperAside"
        ${IfNot} ${Errors}
          Delete /REBOOTOK "$CopperAside"
          ${Break}
        ${EndIf}
      ${ElseIf} $CopperAttempt == 5
        StrCpy $CopperAside "${_file}${COPPER_ASIDE}2"
        Delete "$CopperAside"
        ClearErrors
        Rename "${_file}" "$CopperAside"
        ${IfNot} ${Errors}
          Delete /REBOOTOK "$CopperAside"
        ${EndIf}
        ${Break}
      ${EndIf}
      Sleep 600
      IntOp $CopperAttempt $CopperAttempt + 1
    ${Loop}
  ${EndIf}
!macroend

!macro CopperFreeInstallDir
  !insertmacro CopperFreeFile "$INSTDIR\${COPPER_MAIN_EXE}"
  !insertmacro CopperFreeFile "$INSTDIR\WebView2Loader.dll"
  !insertmacro CopperFreeFile "$INSTDIR\uninstall.exe"
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro CopperFreeInstallDir
!macroend

!macro NSIS_HOOK_POSTINSTALL
  Delete /REBOOTOK "$INSTDIR\*${COPPER_ASIDE}*"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro CopperFreeInstallDir
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete /REBOOTOK "$INSTDIR\*${COPPER_ASIDE}*"
!macroend
