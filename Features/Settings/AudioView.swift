//
//  AudioView.swift
//  Hoshi Reader
//
//  Copyright © 2026 Manhhao.
//  SPDX-License-Identifier: GPL-3.0-or-later
//

import SwiftUI

struct AudioView: View {
    @Environment(UserConfig.self) var userConfig
    @State private var input = ""
    
    var body: some View {
        List {
            Section("Sources") {
                ForEach(Array(userConfig.audioSources.enumerated()), id: \.element.id) { index, source in
                    Toggle(isOn: Binding(
                        get: { source.isEnabled },
                        set: { userConfig.audioSources[index].isEnabled = $0 }
                    )) {
                        Text(source.url)
                            .lineLimit(1)
                    }
                    .deleteDisabled(source.isDefault)
                }
                .onDelete { indexSet in
                    userConfig.audioSources.remove(atOffsets: indexSet)
                }
            }
            
            Section("Add Source") {
                HStack {
                    TextField("URL", text: $input)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    Button {
                        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !trimmed.isEmpty && !userConfig.audioSources.contains(where: { $0.url == trimmed }) {
                            userConfig.audioSources.append(AudioSource(url: trimmed))
                            input = ""
                        }
                    } label: {
                        Image(systemName: "plus")
                    }
                    .disabled(input.isEmpty)
                    .buttonStyle(.plain)
                }
            }
        }
        .navigationTitle("Audio")
    }
}
