; HUD Manager (mo_ORT) — installer. Built by installer\build.ps1 (makensis /DVERSION= /DSTAGE= /DICON= /DOUT=).
; Per user, no admin rights: the program goes where JTs Hud Manager lives (%LOCALAPPDATA%\Programs\jts-hud),
; the New HUD into %USERPROFILE%\jthm-huds\newHud. User data (%APPDATA%\jts-hud, uploads) is never touched.
Unicode true
SetCompressor /SOLID lzma
RequestExecutionLevel user

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "Sections.nsh"
!include "LogicLib.nsh"

; /TEST (for checking a build): only unpack the program into /D=..., touch nothing else
; (no closing of a running manager, no HUD, no helper, no shortcuts, no registry)
Var Test

!define APPNAME "HUD Manager (mo_ORT)"
!define EXE "JTs Hud Manager.exe"
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\HudManagerMoOrt"
!define HELPERLNK "newHud key helper.lnk"

Name "${APPNAME} ${VERSION}"
OutFile "${OUT}\HUD-Manager-mo_ORT-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\jts-hud"
BrandingText "${APPNAME} ${VERSION} · github.com/moOrt-dev/hud-manager"
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_COMPONENTSPAGE_SMALLDESC
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_LINK "github.com/moOrt-dev/hud-manager"
!define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/moOrt-dev/hud-manager"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_RESERVEFILE_LANGDLL

LangString SecApp ${LANG_RUSSIAN} "Программа HUD Manager"
LangString SecApp ${LANG_ENGLISH} "HUD Manager program"
LangString SecHud ${LANG_RUSSIAN} "New HUD (11 тем, авто-камера)"
LangString SecHud ${LANG_ENGLISH} "New HUD (11 themes, auto camera)"
LangString SecHelper ${LANG_RUSSIAN} "Помощник клавиш: запуск вместе с Windows"
LangString SecHelper ${LANG_ENGLISH} "Key helper: start with Windows"
LangString SecDesk ${LANG_RUSSIAN} "Ярлык на рабочем столе"
LangString SecDesk ${LANG_ENGLISH} "Desktop shortcut"
LangString DescApp ${LANG_RUSSIAN} "Менеджер HUD для CS2: русский интерфейс, горячие клавиши, команды в консоль CS2 для авто-камеры."
LangString DescApp ${LANG_ENGLISH} "CS2 HUD manager: Russian / English UI, hotkeys, CS2 console commands for the auto camera."
LangString DescHud ${LANG_RUSSIAN} "HUD для трансляций. Ваши загруженные логотипы не удаляются."
LangString DescHud ${LANG_ENGLISH} "The broadcast HUD. Logos you uploaded are kept."
LangString DescHelper ${LANG_RUSSIAN} "Авто-камера на серверах с VAC (без -insecure): нажимает цифру игрока в CS2, только когда окно CS2 активно."
LangString DescHelper ${LANG_ENGLISH} "Auto camera on VAC servers (no -insecure): presses the player's number in CS2, only while CS2 is the active window."
LangString DescDesk ${LANG_RUSSIAN} "Ярлык HUD Manager на рабочем столе."
LangString DescDesk ${LANG_ENGLISH} "A HUD Manager shortcut on the desktop."
LangString HelperName ${LANG_RUSSIAN} "Помощник клавиш авто-камеры"
LangString HelperName ${LANG_ENGLISH} "Auto camera key helper"

; close a running manager (and the key helper) so the files can be replaced
!macro CloseApp
  nsExec::Exec 'taskkill /F /IM "${EXE}"'
  ; the helper's own script stops it (and removes its autostart; the helper section adds it back)
  ${If} ${FileExists} "$INSTDIR\newhud-helper\uninstall-autostart.cmd"
    nsExec::Exec 'cmd /c ""$INSTDIR\newhud-helper\uninstall-autostart.cmd" < nul"'
  ${EndIf}
  Sleep 1000
!macroend

Section "!$(SecApp)" SEC_APP
  SectionIn RO
  StrCmp $Test "1" skipclose
    !insertmacro CloseApp
  skipclose:
  SetOutPath "$INSTDIR"
  File /r "${STAGE}\app\*.*"
  SetOutPath "$INSTDIR\newhud-helper"
  File /r "${STAGE}\helper\*.*"
  WriteUninstaller "$INSTDIR\Uninstall HUD Manager.exe"
  StrCmp $Test "1" 0 notestapp
    Return
  notestapp:
  CreateShortcut "$SMPROGRAMS\${APPNAME}.lnk" "$INSTDIR\${EXE}"
  CreateShortcut "$SMPROGRAMS\$(HelperName).lnk" "$INSTDIR\newhud-helper\newhud-key-helper.cmd"
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "mo_ORT"
  WriteRegStr HKCU "${UNKEY}" "URLInfoAbout" "https://github.com/moOrt-dev/hud-manager"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\${EXE}"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Uninstall HUD Manager.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
SectionEnd

Section "$(SecHud)" SEC_HUD
  SetOutPath "$PROFILE\jthm-huds\newHud"
  File /r "${STAGE}\hud\newHud\*.*"
SectionEnd

Section "$(SecHelper)" SEC_HELPER
  CreateShortcut "$SMSTARTUP\${HELPERLNK}" "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$INSTDIR\newhud-helper\newhud-key-helper.ps1"' "" "" SW_SHOWMINIMIZED
  Exec '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$INSTDIR\newhud-helper\newhud-key-helper.ps1"'
SectionEnd

Section "$(SecDesk)" SEC_DESK
  CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXE}"
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_APP} $(DescApp)
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_HUD} $(DescHud)
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_HELPER} $(DescHelper)
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_DESK} $(DescDesk)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; after the sections: it needs their ids
Function .onInit
  StrCpy $Test "0"
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/TEST" $1
  ${IfNot} ${Errors}
    StrCpy $Test "1"
    !insertmacro UnselectSection ${SEC_HUD}
    !insertmacro UnselectSection ${SEC_HELPER}
    !insertmacro UnselectSection ${SEC_DESK}
  ${EndIf}
  !insertmacro MUI_LANGDLL_DISPLAY
FunctionEnd

; uninstall: the program, shortcuts and the helper autostart. The HUD folder and the user data stay.
Section "Uninstall"
  !insertmacro CloseApp
  Delete "$SMSTARTUP\${HELPERLNK}"
  Delete "$DESKTOP\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\$(HelperName).lnk"
  ${If} ${FileExists} "$INSTDIR\${EXE}"
    RMDir /r "$INSTDIR"
  ${EndIf}
  DeleteRegKey HKCU "${UNKEY}"
SectionEnd

Function un.onInit
  !insertmacro MUI_UNGETLANGUAGE
FunctionEnd
