using System;
using System.Diagnostics;
using System.Threading;
using Windows.Foundation;
using Windows.Storage.Streams;

namespace LwMedia {
  // PS 5.1 下 OpenReadAsync 的结果是未投影的 __ComObject，PowerShell 无法调用其方法；
  // 此辅助类在 C# 中以强类型完成等待与读取（轮询代替事件，避免额外程序集依赖）
  public static class ThumbReader {
    static T WaitOp<T>(IAsyncOperation<T> op, int timeoutMs) {
      var sw = Stopwatch.StartNew();
      while (op.Status == AsyncStatus.Started && sw.ElapsedMilliseconds < timeoutMs) Thread.Sleep(15);
      return op.Status == AsyncStatus.Completed ? op.GetResults() : default(T);
    }
    public static string LastError = "";
    // PS 主线程为 STA：WinRT 流式异步操作在此上下文会停在 Started（无消息泵），
    // 放到 MTA 后台线程执行即可正常完成
    public static byte[] Read(object thumbRef) {
      LastError = "";
      if (thumbRef == null) { LastError = "no-thumb"; return null; }
      byte[] result = null;
      Exception err = null;
      var t = new Thread(() => {
        try { result = ReadOnMta(thumbRef); }
        catch (Exception ex) { err = ex; }
      });
      t.IsBackground = true;
      t.SetApartmentState(ApartmentState.MTA);
      t.Start();
      if (!t.Join(8000)) { LastError = "timeout"; return null; }
      if (err != null) { LastError = "ex=" + err.Message; return null; }
      return result;
    }
    static byte[] ReadOnMta(object thumbRef) {
      var r = (RandomAccessStreamReference)thumbRef;
      var stream = WaitOp(r.OpenReadAsync(), 5000);
      if (stream == null) return null;
      ulong size = stream.Size;
      if (size == 0 || size > 8388608) return null;
      var reader = new DataReader(stream.GetInputStreamAt(0));
      uint loaded = WaitOp(reader.LoadAsync((uint)size), 5000);
      if (loaded == 0) return null;
      var bytes = new byte[loaded];
      reader.ReadBytes(bytes);
      return bytes;
    }
  }
}
