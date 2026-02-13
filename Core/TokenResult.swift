import Foundation
import NaturalLanguage

struct TokenResult {
    let text: String
    let range: Range<String.Index>
    let rangeOffset: Int
    let rangeLength: Int
}

class NLPService {
    static let shared = NLPService()
    
    private let tagger: NLTagger
    
    private init() {
        self.tagger = NLTagger(tagSchemes: [.tokenType, .lexicalClass, .lemma])
    }
    
    func findWord(in sentence: String, at index: Int) -> TokenResult? {
        guard index >= 0, index < sentence.count else {
            return nil
        }
        
        let safeIndex = sentence.index(sentence.startIndex, offsetBy: index)
        
        tagger.string = sentence
        
        var foundToken: TokenResult?
        
        tagger.enumerateTags(
            in: sentence.startIndex..<sentence.endIndex,
            unit: .word,
            scheme: .tokenType,
            options: []
        ) { tag, range in
            
            let word = String(sentence[range])
            let offset = sentence.distance(from: sentence.startIndex, to: range.lowerBound)
            let length = sentence.distance(from: range.lowerBound, to: range.upperBound)
            
            if safeIndex >= range.lowerBound && safeIndex < range.upperBound {
                foundToken = TokenResult(
                    text: word,
                    range: range,
                    rangeOffset: offset,
                    rangeLength: length
                )
            }
            
            return true
        }
        
        return foundToken
    }
}
