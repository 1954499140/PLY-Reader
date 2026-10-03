//go:build windows
package main
import(
 _ "embed"
 "bytes"
 "encoding/base64"
 "errors"
 "fmt"
 "os"
 "path/filepath"
 "runtime"
 "strings"
 "unsafe"
 webview "github.com/jchv/go-webview2"
 "github.com/jchv/go-webview2/webviewloader"
 "golang.org/x/sys/windows"
)
//go:embed web/index.html
var html string
var user32=windows.NewLazySystemDLL("user32.dll")
var comdlg32=windows.NewLazySystemDLL("comdlg32.dll")
func message(text string){user32.NewProc("MessageBoxW").Call(0,uintptr(unsafe.Pointer(windows.StringToUTF16Ptr(text))),uintptr(unsafe.Pointer(windows.StringToUTF16Ptr("PLY Studio"))),0x10)}
type openFileName struct{
 StructSize uint32
 Owner uintptr
 Instance uintptr
 Filter *uint16
 CustomFilter *uint16
 MaxCustomFilter uint32
 FilterIndex uint32
 File *uint16
 MaxFile uint32
 FileTitle *uint16
 MaxFileTitle uint32
 InitialDir *uint16
 Title *uint16
 Flags uint32
 FileOffset uint16
 FileExtension uint16
 DefaultExtension *uint16
 CustomData uintptr
 Hook uintptr
 TemplateName *uint16
 Reserved unsafe.Pointer
 Reserved2 uint32
 FlagsEx uint32
}
func saveDialog(owner uintptr,name string)(string,error){
 buffer:=make([]uint16,32768);initial,err:=windows.UTF16FromString(filepath.Base(name));if err!=nil{return "",err};copy(buffer,initial)
 filter:=append(windows.StringToUTF16("PNG image (*.png)"),windows.StringToUTF16("*.png")...);filter=append(filter,0)
 data:=openFileName{Owner:owner,Filter:&filter[0],FilterIndex:1,File:&buffer[0],MaxFile:uint32(len(buffer)),Title:windows.StringToUTF16Ptr("保存当前视角图片"),DefaultExtension:windows.StringToUTF16Ptr("png"),Flags:0x2|0x800|0x80000|0x8};data.StructSize=uint32(unsafe.Sizeof(data))
 ok,_,_:=comdlg32.NewProc("GetSaveFileNameW").Call(uintptr(unsafe.Pointer(&data)));runtime.KeepAlive(filter);runtime.KeepAlive(buffer)
 if ok==0{code,_,_:=comdlg32.NewProc("CommDlgExtendedError").Call();if code!=0{return "",fmt.Errorf("无法打开保存窗口（0x%x）",code)};return "",nil}
 path:=windows.UTF16ToString(buffer);if !strings.EqualFold(filepath.Ext(path),".png"){return "",errors.New("请选择以 .png 结尾的文件名")};return path,nil
}
func main(){
 runtime.LockOSThread();dpi:=user32.NewProc("SetProcessDpiAwarenessContext");if dpi.Find()==nil{dpi.Call(^uintptr(3))}
 if _,err:=webviewloader.GetInstalledVersion();err!=nil{message("未找到 Microsoft Edge WebView2 Runtime。\n\n请安装微软官方 WebView2 运行时后重新打开程序：\nhttps://developer.microsoft.com/microsoft-edge/webview2/\n\n本程序无需 Python。");return}
 config,err:=os.UserConfigDir();if err!=nil{message("无法访问用户配置目录："+err.Error());return};dataPath:=filepath.Join(config,"PLYStudio","WebView2");if err:=os.MkdirAll(dataPath,0700);err!=nil{message("无法创建配置目录："+err.Error());return}
 app:=webview.NewWithOptions(webview.WebViewOptions{Debug:false,DataPath:dataPath,AutoFocus:true,WindowOptions:webview.WindowOptions{Title:"PLY Studio · 点云视角工作台",Width:1360,Height:920,Center:true,IconId:1}});if app==nil{message("三维窗口初始化失败，请检查 WebView2 运行时和显卡驱动。");return};defer app.Destroy();app.SetSize(820,620,webview.HintMin)
 dark:=int32(1);windows.NewLazySystemDLL("dwmapi.dll").NewProc("DwmSetWindowAttribute").Call(uintptr(app.Window()),20,uintptr(unsafe.Pointer(&dark)),unsafe.Sizeof(dark))
 err=app.Bind("nativeSavePNG",func(encoded string,name string)(map[string]interface{},error){
  if len(encoded)>100*1024*1024{return nil,errors.New("图片太大，请降低分辨率")};data,err:=base64.StdEncoding.DecodeString(encoded);if err!=nil{return nil,errors.New("PNG 数据编码无效")};if len(data)<8||!bytes.Equal(data[:8],[]byte{137,80,78,71,13,10,26,10}){return nil,errors.New("图片不是有效的 PNG")}
  path,err:=saveDialog(uintptr(app.Window()),name);if err!=nil{return nil,err};if path==""{return map[string]interface{}{"cancelled":true},nil}
  temp,err:=os.CreateTemp(filepath.Dir(path),".plystudio-*.png");if err!=nil{return nil,err};temporary:=temp.Name();defer os.Remove(temporary);if _,err=temp.Write(data);err!=nil{temp.Close();return nil,err};if err=temp.Close();err!=nil{return nil,err}
  source,_:=windows.UTF16PtrFromString(temporary);destination,_:=windows.UTF16PtrFromString(path);ok,_,moveErr:=windows.NewLazySystemDLL("kernel32.dll").NewProc("MoveFileExW").Call(uintptr(unsafe.Pointer(source)),uintptr(unsafe.Pointer(destination)),0x1|0x8);if ok==0{return nil,moveErr};return map[string]interface{}{"path":path},nil
 });if err!=nil{message("初始化保存功能失败："+err.Error());return};app.SetHtml(html);app.Run()
}
