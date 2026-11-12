; Install the drivers XBridge depends on, only when they are missing.
; ViGEmBus creates the virtual Xbox controller; HidHide can hide the physical one from games.
; Drivers are shared with other apps, so the uninstaller leaves them in place.

!macro XBridgeDriver NAME SERVICE FILE
  ReadRegStr $0 HKLM "SYSTEM\CurrentControlSet\Services\${SERVICE}" "ImagePath"
  ${If} $0 == ""
    DetailPrint "Instalando ${NAME}..."
    File "/oname=$PLUGINSDIR\${FILE}" "${BUILD_RESOURCES_DIR}\drivers\${FILE}"
    ExecWait '"$PLUGINSDIR\${FILE}" /exenoui /qn /norestart' $1
    ${If} $1 == 3010
      SetRebootFlag true
    ${ElseIf} $1 != 0
      MessageBox MB_ICONEXCLAMATION|MB_OK "Não foi possível instalar o ${NAME} (código $1).$\r$\nInstale manualmente depois em github.com/nefarius."
    ${EndIf}
  ${Else}
    DetailPrint "${NAME} já instalado."
  ${EndIf}
!macroend

!macro customInstall
  SetRegView 64
  !insertmacro XBridgeDriver "ViGEmBus" "ViGEmBus" "ViGEmBus_1.22.0_x64_x86_arm64.exe"
  !insertmacro XBridgeDriver "HidHide" "HidHide" "HidHide_1.5.230_x64.exe"
  SetRegView lastused
!macroend
