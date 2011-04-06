function(doc) {
  if (doc.type.indexOf("/type/project") >= 0) {
    emit(doc.title, doc);
    emit(doc.name, doc);
  }
}