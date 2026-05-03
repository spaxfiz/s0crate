use tauri_plugin_shell::{process::CommandEvent, ShellExt};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let project_dir = std::env::current_dir()
                .ok()
                .and_then(|dir| dir.parent().map(|parent| parent.to_path_buf()));
            tauri::async_runtime::spawn(async move {
                let command = if cfg!(debug_assertions) {
                    let command = handle
                        .shell()
                        .command("uv")
                        .args([
                            "run",
                            "uvicorn",
                            "backend.main:app",
                            "--host",
                            "127.0.0.1",
                            "--port",
                            "8421",
                        ]);
                    if let Some(project_dir) = project_dir {
                        command.current_dir(project_dir)
                    } else {
                        command
                    }
                } else {
                    match handle.shell().sidecar("binaries/socrate-backend") {
                        Ok(command) => command,
                        Err(error) => {
                            eprintln!("Failed to prepare backend sidecar: {error}");
                            return;
                        }
                    }
                };

                let (mut rx, child) = match command.spawn() {
                    Ok(child) => child,
                    Err(error) => {
                        eprintln!("Failed to spawn backend: {error}");
                        return;
                    }
                };

                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            print!("{}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprint!("{}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(status) => {
                            println!("Backend exited: {status:?}");
                            break;
                        }
                        _ => {}
                    }
                }

                let _ = child.kill();
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
